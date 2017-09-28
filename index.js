#!/usr/bin/env node

const caporal = require('caporal');
const fs = require('fs');
const fsPath = require('path');
const ytdl = require('ytdl-core');
const mkdirp = require('mkdirp');
const chalk = require('chalk');
const highland = require('highland');
const pkg = require('./package.json');
const youtube = require('./youtube_search');
const spotify = require('./spotify');

const METADATA_FILE = ".downloaded";
const cwd = process.cwd();
const defaultOutputPath = fsPath.join(cwd, 'media');
const configPath = fsPath.join(cwd, 'config.json');

// old debug:
// console.log.apply(this, [chalk.reset.yellow('[DEBUG]'), chalk.reset.gray(...arguments)]);

function init() {

  caporal
    .name('spotivy')
    .help(pkg.description)
    .version(pkg.version)

    // command: download user playlists
    .command('user')
    .help('Download all public playlists from the given user')
    .argument('<username>', 'Username to retrieve playlists')
    .option('-o, --output <output>', 'Location where to save the downloaded media', /\w*/, defaultOutputPath)
    .option('-f, --format <format>', "The format of the file to download. Either 'audio' or 'video'", ["audio", "video"], 'video')
    .option('-a, --audio', "Download tracks as audio. Same as --format audio", caporal.BOOLEAN, false)
    .option('--spotify-client-id [client-id]', 'Spotify app client ID (from https://developer.spotify.com/my-applications/)')
    .option('--spotify-client-secret [client-secret]', 'Spotify app client secret (from https://developer.spotify.com/my-applications/)')
    .option('--youtube-key [key]', 'Youtube API key (from https://console.developers.google.com)')
    .action((args, options, logger) => {
      beforeCommand(logger);
      const config = loadConfig(configPath, Object.assign({}, options, args), { logger });

      logger.info(`Saving ${config.format === 'video' ? 'videos' : 'audios'} to '${config.output}'`);

      cmdDownloadPlaylists(args.username, {
        spotifyClientId: config.spotifyClientId,
        spotifyClientSecret: config.spotifyClientSecret,
        youtubeKey: config.youtubeKey,
        format: config.format,
        output: config.output,
        logger
      });
    })

    // command: download playlist
    .command('playlist')
    .help('Download playlist')
    .action(console.log)

    // command: download track
    .command('track')
    .help('Download single track')
    .action(console.log);
  caporal.parse(process.argv);
}

function beforeCommand(logger) {
  logger.info();
  logger.info(chalk.bold.green(`[${pkg.name} v${pkg.version}]`));
  logger.info();
}

function cmdDownloadPlaylists(username,
  { spotifyClientId, spotifyClientSecret, youtubeKey,
    format, output, logger } = {}) {

  spotify
    .login(spotifyClientId, spotifyClientSecret, { logger })
    .then(_ => youtube.login(youtubeKey))
    .then(function () {
      return downloadUserPlaylists(username, { format, output, logger });
    });
}

init();





function downloadUserPlaylists(username, { format, output, logger } = {}) {
  let path = output;
  let currentMetadata = null;
  let currentMetadataPath = null;
  let currentPlaylist = null;
  let currentPath = null;

  spotify
    .getAllUserPlaylists(username, { logger })
    .sequence()
    .flatMap(playlist => {
      currentPlaylist = playlist;
      currentPath = fsPath.join(path, createFolderName(currentPlaylist.name));
      currentMetadataPath = fsPath.join(currentPath, METADATA_FILE);
      currentMetadata = loadMetadata(currentMetadataPath);


      console.log(chalk.bold.blue("[Downloading playlist]"), currentPlaylist.name);
      return spotify.getAllPlaylistTracks(currentPlaylist.owner.id, currentPlaylist.id, { logger });
    })
    .sequence()
    .map(playlistTrack => playlistTrack.track)
    // skip downloaded songs
    .filter(track => {
      let shouldDownload = !isTrackDownloaded(track.id, currentMetadata);
      if (!shouldDownload && logger)
        logger.debug(`Skip "${track.name}"`);
      return shouldDownload;
    })
    .flatMap(track => {
      console.log(chalk.bold.blue("   [Downloading track]"), track.name);

      const downloadPromise = downloadTrack(track, { format, path: currentPath, logger });
      return highland(downloadPromise)
        .on('error', err => {
          console.error(chalk.bold.red("     [Download failed]"), err.message || err);
        });
    })
    .each(track => {
      updateMetadata(track, { metadata: currentMetadata });
      saveMetadata(currentMetadata, currentMetadataPath);
    })
    .on('error', err => console.error(err))
    .toArray();
}

/**
 * Download the specified track on disk
 * 
 * @param {SpotifyTrack} track
 * @param {Object} options
 * - format: `video` or `audio`
 * - path: where the track will be saved on disk
 */
function downloadTrack(track, { format = 'video', path = './', logger } = {}) {
  let fileName = `${track.artists[0].name} - ${track.name}`;
  let metadataPath = fsPath.join(path, METADATA_FILE);

  let downloadFunction = format === 'video' ? downloadYoutubeVideo : downloadYoutubeAudio;
  return downloadFunction(fileName, path, { logger })
    .then(_ => track);
}

function isTrackDownloaded(trackId, metadata = null, { metadataPath = './' } = {}) {
  if (!metadata) {
    let metadataPath = fsPath.join(metadataPath, METADATA_FILE);
    metadata = loadMetadata(metadataPath);
  }
  return metadata.ids.indexOf(trackId) !== -1;
}

function updateMetadata(track, { metadata = null, metadataPath = './' } = {}) {
  let fileName = `${track.artists[0].name} - ${track.name}`;
  if (!metadata)
    metadata = loadMetadata(fsPath.join(metadataPath, METADATA_FILE));

  // update downloaded tracks control
  metadata.ids.push(track.id);
  // info for humans to understand the metadata file
  metadata.names[track.id] = fileName;

  return metadata;
}

/**
 * Downloads the given video from YouTube.
 *
 * @param {string} name The name of the video to look for
 * @param {string} [location='./'] Where the video file should be saved
 * @returns {PromiseLike}
 */
function downloadYoutubeVideo(name, location = './', { logger } = {}) {
  return new Promise(function (resolve, reject) {
    let fullPath = fsPath.join(location, `${createFolderName(name)}.mp4`);
    // setup folders
    if (!fs.existsSync(location))
      mkdirp.sync(location);

    youtube.searchMusicVideo(name)
      .then(video => {
        if (!video) {
          reject("Video não encontrado");
          return;
        }

        let downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
        if (logger)
          logger.debug(`Downloading video from url: ${downloadUrl}`);

        ytdl(downloadUrl, {
          quality: 18 // 360p
        })
          .on('error', err => reject(err))
          .pipe(fs.createWriteStream(fullPath))
          .on('error', err => reject(err))
          .on('finish', _ => {
            resolve({
              path: fullPath,
              video
            });
          });
      });
  });
}

/**
 * Downloads the audio from the given video from YouTube.
 *
 * @param {string} name The name of the video to look for
 * @param {string} [location='./'] Where the audio file should be saved
 * @returns {PromiseLike}
 */
function downloadYoutubeAudio(name, location = './', { logger } = {}) {
  return new Promise(function (resolve, reject) {

    /**
     * Example string: audio/mp4; codecs="mp4a.40.2"
     * Group #0: audio/mp4; codecs="mp4a.40.2"
     * Group #1: audio/mp4
     * Group #2: audio
     * Group #3: mp4
     * Group #4: mp4a.40.2
     */
    let formatTypeRegex = /((.*)\/(.*)); codecs="(.*)"/;

    let fullPath = fsPath.join(location, `${createFolderName(name)}.mp3`);
    // setup folders
    if (!fs.existsSync(location))
      mkdirp.sync(location);

    youtube.searchMusicAudio(name)
      .then(video => {
        if (!video) {
          reject("Áudio não encontrado");
          return;
        }

        let downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
        if (logger)
          logger.debug(`Downloading audio from url: ${downloadUrl}`);

        ytdl(downloadUrl, {
          filter: function (f) {
            if (!f.type) return false;

            let [, typeAndFormat, type, format, codec] = formatTypeRegex.exec(f.type);
            let shouldDownload = type === 'audio' && format === 'mp4';

            if (shouldDownload && logger)
              logger.debug(`File type: ${typeAndFormat} (${codec})`);

            return shouldDownload;
          }
        })
          .on('error', err => reject(err))
          .pipe(fs.createWriteStream(fullPath))
          .on('error', err => reject(err))
          .on('finish', _ => {
            resolve({
              path: fullPath,
              video
            });
          });
      });
  });
}

function loadMetadata(location) {
  if (!fs.existsSync(location))
    saveMetadata({
      ids: [],
      names: {}
    }, location);

  return JSON.parse(fs.readFileSync(location, 'utf-8'));
}

function saveMetadata(metadata, location) {
  if (!fs.existsSync(location))
    mkdirp.sync(fsPath.dirname(location));
  fs.writeFileSync(location, JSON.stringify(metadata, null, 2));
}

/**
 * Transform the given string to a folder-friendly name for windows
 *
 * @param {string} name
 * @returns {string} the modified name
 */
function createFolderName(name) {
  return name
    .replace(/[\\\/\*<>]/gi, '-')
    .replace(/"/gi, "'")
    .replace(/[\?:]/gi, "");
}

function loadConfig(configFilePath, parsedArgs, { logger } = {}) {
  const config = {};
  try {
    const configFile = require(configFilePath);
    config.spotifyClientId = configFile.spotify.clientId;
    config.spotifyClientSecret = configFile.spotify.clientSecret;
    config.youtubeKey = configFile.youtube.key;
  } catch (e) { }

  // parsed args have preference
  parsedArgs = JSON.parse(JSON.stringify(parsedArgs)); // remove undefined keys
  Object.assign(config, parsedArgs);

  if (config.audio) config.format = 'audio';

  if (logger)
    logger.debug(`Loaded options:\n`, JSON.stringify(config, null, 2));

  return config;
}