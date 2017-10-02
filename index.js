#!/usr/bin/env node

const caporal = require('caporal');
const leftPad = require('left-pad');
const fs = require('fs');
const fsPath = require('path');
const ytdl = require('ytdl-core');
const mkdirp = require('mkdirp');
const chalk = require('chalk');
const highland = require('highland');

const pkg = require('./package.json');
const youtube = require('./youtube_search');
const spotify = require('./spotify');
const { INFO_COLUMN_WIDTH } = require('./constants');
const { info, debug } = require('./log');

const METADATA_FILE = ".downloaded";
const cwd = process.cwd();
const defaultOutputPath = fsPath.join(cwd, 'media');
const configPath = fsPath.join(cwd, 'config.json');

// https://en.wikipedia.org/w/index.php?title=YouTube&oldid=800910021#Quality_and_formats
const qualityMap = {
  '144p': 17,
  '240p': 36,
  '360p': 18,
  '720p': 22,
  'highest': 'highest',
  'lowest': 'lowest'
};

function init() {
  caporal
    .name('spotivy')
    .help(pkg.description)
    .version(pkg.version)

    // command: download user playlist(s)
    .command('playlist')
    .help('Download public playlists from the given user')
    .argument('<username>', 'The id of the playlist owner')
    .argument('[playlists...]', 'Playlist IDs. If none, all user playlists will be downloaded')
    .option('-o, --output <output>', 'Location where to save the downloaded media', /\w*/, defaultOutputPath)
    .option('-f, --format <format>', "The format of the file to download. Either 'audio' or 'video'", ["audio", "video"], 'video')
    .option('-q, --quality <quality>', `The quality of the video to download (desconsidered if format=audio).\nOptions: ${Object.keys(qualityMap).join(', ')}`, Object.keys(qualityMap), 'highest')
    .option('-a, --audio', "Download tracks as audio. Same as --format audio", caporal.BOOLEAN, false)
    .option('--spotify-client-id [client-id]', 'Spotify app client ID (from https://developer.spotify.com/my-applications/)')
    .option('--spotify-client-secret [client-secret]', 'Spotify app client secret (from https://developer.spotify.com/my-applications/)')
    .option('--youtube-key [key]', 'Youtube API key (from https://console.developers.google.com)')
    .action((args, options, logger) => {
      beforeCommand(logger);

      const config = loadConfig(configPath, Object.assign({}, options, args), { logger });
      let cmdPromise;

      info(logger, `Saving media to '${config.output}'\n`);

      if (!args.playlists.length) {
        cmdPromise = cmd_user(args.username, {
          spotifyClientId: config.spotifyClientId,
          spotifyClientSecret: config.spotifyClientSecret,
          youtubeKey: config.youtubeKey,
          format: config.format,
          quality: qualityMap[config.quality],
          output: config.output,
          logger
        });
      } else {
        cmdPromise = cmd_playlist(args.username, args.playlists, {
          spotifyClientId: config.spotifyClientId,
          spotifyClientSecret: config.spotifyClientSecret,
          youtubeKey: config.youtubeKey,
          format: config.format,
          quality: qualityMap[config.quality],
          output: config.output,
          logger
        })
      }

      cmdPromise.then(() => afterCommand(logger));
    })

    // command: download track
    .command('track')
    .help('Download single track')
    .argument('<tracks...>', 'Track IDs (may be more than one)')
    .option('-o, --output <output>', 'Location where to save the downloaded media', /\w*/, defaultOutputPath)
    .option('-f, --format <format>', "The format of the file to download. Either 'audio' or 'video'", ["audio", "video"], 'video')
    .option('-q, --quality <quality>', `The quality of the video to download (desconsidered if format=audio).\nOptions: ${Object.keys(qualityMap).join(', ')}`, Object.keys(qualityMap), 'highest')
    .option('-a, --audio', "Download tracks as audio. Same as --format audio", caporal.BOOLEAN, false)
    .option('--spotify-client-id [client-id]', 'Spotify app client ID (from https://developer.spotify.com/my-applications/)')
    .option('--spotify-client-secret [client-secret]', 'Spotify app client secret (from https://developer.spotify.com/my-applications/)')
    .option('--youtube-key [key]', 'Youtube API key (from https://console.developers.google.com)')
    .action((args, options, logger) => {
      beforeCommand(logger);
      const config = loadConfig(configPath, Object.assign({}, options, args), { logger });

      info(logger, `Saving media to '${config.output}'\n`);

      cmd_track(args.tracks, {
        spotifyClientId: config.spotifyClientId,
        spotifyClientSecret: config.spotifyClientSecret,
        youtubeKey: config.youtubeKey,
        format: config.format,
        quality: qualityMap[config.quality],
        output: config.output,
        logger
      })
        .then(() => afterCommand(logger));
    });
  caporal.parse(process.argv);
}

function beforeCommand(logger) {
  info(logger, chalk.bold.green(`[${pkg.name} v${pkg.version}]`));
}

function afterCommand(logger) {
  info(logger);
  info(logger, chalk.bold.green(`[${pkg.name} v${pkg.version}]`), 'Finished successfuly');
}

function cmd_user(username,
  { spotifyClientId, spotifyClientSecret, youtubeKey,
    format, quality, output, logger } = {}) {

  return new Promise((resolve, reject) => {
    spotify
      .login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(function () {
        return downloadUserPlaylists(username, { format, quality, output, logger })
          .done(resolve);
      });
  });
}

function cmd_playlist(username, playlists,
  { spotifyClientId, spotifyClientSecret, youtubeKey,
    format, quality, output, logger } = {}) {

  return new Promise((resolve, reject) => {
    spotify.login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(() => {
        highland(playlists)
          .flatMap(playlist => highland(spotify.getPlaylist(username, playlist)))
          .flatMap(playlist => highland(downloadPlaylist(playlist, { format, quality, path: output, logger })))
          .errors(err => info(logger, chalk.bold.red(leftPad("[Download failed]", INFO_COLUMN_WIDTH)), err.message || err, err.stack))
          .done(resolve);
      });
  });
}

function cmd_track(tracks,
  { spotifyClientId, spotifyClientSecret, youtubeKey,
    format, quality, output, logger } = {}) {

  return new Promise((resolve, reject) => {
    spotify.login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(() => {
        highland(tracks)
          .flatMap(track => highland(spotify.getTrack(track)))
          .flatMap(track => highland(downloadTrack(track, { format, quality, path: output, logger })))
          .errors(err => info(logger, chalk.bold.red(leftPad("[Download failed]", INFO_COLUMN_WIDTH)), err.message || err, err.stack))
          .done(resolve);
      });
  });
}

init();


// https://open.spotify.com/track/0SFJQqnU0k42NYaLb3qqTx
// https://open.spotify.com/track/31acMiV67UgKn1ScFChFxo
// https://open.spotify.com/track/52K4Nl7eVNqUpUeJeWJlwT
// https://open.spotify.com/track/5tXyNhNcsnn7HbcABntOSf

function downloadUserPlaylists(username, { format, quality, output, logger } = {}) {
  let path = output;
  let currentMetadata = null;
  let currentMetadataPath = null;
  let currentPlaylist = null;
  let currentPath = null;
  let currentTrack = null;

  return spotify
    .getAllUserPlaylists(username, { logger })
    .sequence()
    .flatMap(playlist => {
      currentPlaylist = playlist;
      currentPath = fsPath.join(path, createFolderName(currentPlaylist.name));
      currentMetadataPath = fsPath.join(currentPath, METADATA_FILE);
      currentMetadata = loadMetadata(currentMetadataPath);

      console.log(chalk.bold.blue(leftPad("[Downloading playlist]", INFO_COLUMN_WIDTH)), currentPlaylist.name);
      return spotify.getAllPlaylistTracks(currentPlaylist.owner.id, currentPlaylist.id, { logger });
    })
    .sequence()
    .map(playlistTrack => playlistTrack.track)
    // skip downloaded songs
    .filter(track => {
      let shouldDownload = !isTrackDownloaded(track.id, currentMetadata);
      if (!shouldDownload)
        debug(logger, `Skip "${track.name}"`);
      return shouldDownload;
    })
    .flatMap(track => {
      currentTrack = track;

      const downloadPromise = downloadTrack(track, { format, quality, path: currentPath, logger });
      return highland(downloadPromise);
    })
    .each(() => {
      updateMetadata(currentTrack, { metadata: currentMetadata });
      saveMetadata(currentMetadata, currentMetadataPath);
    });
}

/**
 * Download all tracks from the given playlist
 * 
 * @param {SpotifyPlaylist} playlist 
 * @param {*} param1 
 */
function downloadPlaylist(playlist, { format = 'video', quality, path = './', logger } = {}) {
  info(logger, chalk.bold.blue(leftPad("[Downloading playlist]", INFO_COLUMN_WIDTH)), playlist.name);

  return spotify
    .getAllPlaylistTracks(playlist.owner.id, playlist.id, { logger })
    .sequence()
    .map(playlistTrack => playlistTrack.track)
    .flatMap(track => {
      const downloadPromise = downloadTrack(track, { format, quality, path, logger });
      return highland(downloadPromise);
    });
}

/**
 * Download the specified track on disk
 * 
 * @param {SpotifyTrack} track
 * @param {Object} options
 * - format: `video` or `audio`
 * - path: where the track will be saved on disk
 */
function downloadTrack(track, { format = 'video', quality, path = './', logger } = {}) {
  let trackName = `${track.artists[0].name} - ${track.name}`;
  info(logger, chalk.bold.blue(leftPad("[Downloading track]", INFO_COLUMN_WIDTH)), trackName);

  let downloadFunction = format === 'video' ? downloadYoutubeVideo : downloadYoutubeAudio;
  return downloadFunction(trackName, path, { quality, logger });
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
 * @returns {Promise}
 */
function downloadYoutubeVideo(name, location = './', { quality = 'highest', logger } = {}) {
  let fullPath = fsPath.join(location, `${createFolderName(name)}.mp4`);
  // setup folders
  if (!fs.existsSync(location))
    mkdirp.sync(location);

  let videoSearchPromise = youtube.searchMusicVideo(name, { logger });

  return highland(videoSearchPromise) // search the video
    .flatMap(video => highland((push, next) => {
      if (!video)
        throw new Error("Video not found");

      let downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
      debug(logger, `Download from: ${downloadUrl}`);
      debug(logger, `Download to  : ${fullPath}`);

      let writeStream = fs.createWriteStream(fullPath);
      let videoStream = ytdl(downloadUrl, { quality });

      return highland(videoStream)
        .pipe(writeStream)
        .on('finish', () => {
          debug(logger, 'Finish write:', name);
          push(null, highland.nil);
        });
    }));
}


/**
 * Downloads the audio from the given video from YouTube.
 *
 * @param {string} name The name of the video to look for
 * @param {string} [location='./'] Where the audio file should be saved
 * @returns {Highland.Stream}
 */
function downloadYoutubeAudio(name, location = './', { logger } = {}) {
  /**
   * Example string: audio/mp4; codecs="mp4a.40.2"
   * - Group #0: audio/mp4; codecs="mp4a.40.2"
   * - Group #1: audio/mp4
   * - Group #2: audio
   * - Group #3: mp4
   * - Group #4: mp4a.40.2
   */
  let formatTypeRegex = /((.*)\/(.*)); codecs="(.*)"/;

  let fullPath = fsPath.join(location, `${createFolderName(name)}.mp3`);
  // setup folders
  if (!fs.existsSync(location))
    mkdirp.sync(location);

  return highland(youtube.searchMusicAudio(name, { logger }))
    .flatMap(video => highland((push, next) => {
      if (!video)
        throw new Error("Audio not found");

      let downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
      debug(logger, `Download from: ${downloadUrl}`);
      debug(logger, `Download to  : ${fullPath}`);

      let writeStream = fs.createWriteStream(fullPath);
      let videoStream = ytdl(downloadUrl, {
        quality: 140, // M4A AAC 128 kbps
        filter: function mp4AudioFilter(f) {
          if (!f.type) return false;

          let [, typeAndFormat, type, format, codec] = formatTypeRegex.exec(f.type);
          let shouldDownload = type === 'audio' && format === 'mp4';

          if (shouldDownload)
            debug(logger, `File type: ${typeAndFormat} (${codec})`);

          return shouldDownload;
        }
      });

      return highland(videoStream)
        .pipe(writeStream)
        .on('finish', () => {
          debug(logger, 'Finish write:', name);
          push(null, highland.nil);
        });
    }));
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

  debug(logger, `Loaded options:\n`, JSON.stringify(config, null, 2));

  return config;
}