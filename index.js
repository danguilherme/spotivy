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
const { info, debug, warn } = require('./log');

// commands
const { init: cmd_init } = require('./commands');

const METADATA_FILE = ".downloaded";
const cwd = process.cwd();
const defaultOutputPath = fsPath.join(cwd, 'media');
const configPath = fsPath.join(cwd, 'config.json');
const throughStream = () => highland((push, next) => push(null, highland.nil));

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
    .version(pkg.version)
    .help(pkg.description);

  // command: download user playlist(s)
  var commandInit = caporal.command('init', 'Tool introduction and configuration')
    .help('Configure the tool with the keys from Spotify and YouTube. Creates the config file in the current folder.')
    .action((args, options, logger) => {
      beforeCommand(logger);

      cmd_init(configPath, { logger })
        .then(() => afterCommand(logger));
    });

  // command: download user playlist(s)
  var commandPlaylist = caporal.command('playlist', 'Download public playlists from the given user')
    .help('Download public playlists from the given user')
    .argument('<username>', 'The id of the playlist owner')
    .argument('[playlists...]', 'Playlist IDs. If none, all user playlists will be downloaded')
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
          flat: config.flat,
          logger
        });
      } else {
        cmdPromise = cmd_playlist(args.playlists, {
          spotifyClientId: config.spotifyClientId,
          spotifyClientSecret: config.spotifyClientSecret,
          youtubeKey: config.youtubeKey,
          format: config.format,
          quality: qualityMap[config.quality],
          output: config.output,
          flat: config.flat,
          logger
        })
      }

      cmdPromise.then(() => afterCommand(logger));
    });

  // command: download track
  let commandTrack = caporal.command('track', 'Download single tracks')
    .help('Download single tracks')
    .argument('<tracks...>', 'Track IDs (may be more than one)')
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
        flat: config.flat,
        logger
      })
        .then(() => afterCommand(logger));
    });

  configureGlobalOptions(commandPlaylist);
  configureGlobalOptions(commandTrack);

  caporal.parse(process.argv);
}

function configureGlobalOptions(caporalCommand) {
  return caporalCommand
    .option('-o, --output <output>', 'Location where to save the downloaded media', /\w*/, defaultOutputPath)
    .option('-f, --format <format>', "The format of the file to download. Either 'video' or 'audio'", ["audio", "video"], 'video')
    .option('-q, --quality <quality>', `The quality of the video to download (desconsidered if format=audio).\nOptions: ${Object.keys(qualityMap).join(', ')}`, Object.keys(qualityMap), 'highest')
    .option('--flat', 'Flag to indicate if the files must be saved directly in the output folder, without subfolders', caporal.BOOLEAN, false)
    .option('-a, --audio', "Download tracks as audio. Same as --format audio", caporal.BOOLEAN, false)
    .option('--spotify-client-id [client-id]', 'Spotify app client ID (from https://developer.spotify.com/my-applications/)')
    .option('--spotify-client-secret [client-secret]', 'Spotify app client secret (from https://developer.spotify.com/my-applications/)')
    .option('--youtube-key [key]', 'Youtube API key (from https://console.developers.google.com)');
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
    format, quality, output, flat, logger } = {}) {

  return new Promise((resolve, reject) => {
    spotify
      .login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(function () {
        return downloadUserPlaylists(username, { format, quality, path: output, createSubFolder: !flat, logger })
          .errors(err => handleDownloadError(err, logger))
          .done(resolve);
      });
  });
}

function cmd_playlist(playlists,
  { spotifyClientId, spotifyClientSecret, youtubeKey,
    format, quality, output, flat, logger } = {}) {

  return new Promise((resolve, reject) => {

    spotify.login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(() => {
        highland(playlists)
          .flatMap(playlist => highland(spotify.getPlaylist(playlist)))
          .flatMap(playlist => downloadPlaylist(playlist, { format, quality, path: output, createSubFolder: !flat, logger }))
          .errors(err => handleDownloadError(err, logger))
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
          .errors(err => handleDownloadError(err, logger))
          .done(resolve);
      });
  });
}

function handleDownloadError(err, logger) {
  info(logger, chalk.bold.red(leftPad("[Download failed]", INFO_COLUMN_WIDTH)), err.message || err);
  debug(logger, err.stack);

  const extraInfo = JSON.stringify(err, null, 2);
  if (extraInfo !== '{}') {
    debug(logger, 'Extra info:\n' + JSON.stringify(err, null, 2));
  }
}

init();





function downloadUserPlaylists(username,
  { format, quality, path, createSubFolder = true, logger } = {}) {

  if (createSubFolder)
    path = fsPath.join(path, createFolderName(username));

  return spotify
    .getAllUserPlaylists(username, { logger })
    .sequence()
    .flatMap(playlist => downloadPlaylist(playlist, { format, quality, path, createSubFolder, logger }));
}

/**
 * Download all tracks from the given playlist
 * 
 * @param {SpotifyPlaylist} playlist 
 * @param {*} param1 
 */
function downloadPlaylist(playlist,
  { format = 'video', quality, path = './', createSubFolder = true, logger } = {}) {
  info(logger, chalk.bold.blue(leftPad("[Downloading playlist]", INFO_COLUMN_WIDTH)), playlist.name);

  let targetPath = path;
  if (createSubFolder)
    targetPath = fsPath.join(path, createFolderName(playlist.name));
  let metadataPath = fsPath.join(targetPath, METADATA_FILE);
  let metadata = getMetadata(metadataPath);

  return spotify
    .getAllPlaylistTracks(playlist.id, { logger })
    .sequence()
    .map(playlistTrack => playlistTrack.track)
    .filter(track => !isTrackDownloaded(track.id, metadata))
    .flatMap(track => downloadTrack(track, { format, quality, path: targetPath, logger, metadata }));
}

/**
 * Download the specified track on disk
 * 
 * @param {SpotifyTrack} track
 * @param {Object} options
 * - format: `video` or `audio`
 * - path: where the track will be saved on disk
 */
function downloadTrack(track,
  { format = 'video', quality, path = './', logger,
    metadata } = {}) {

  let trackName = `${track.artists[0].name} - ${track.name}`;
  info(logger, chalk.bold.blue(leftPad("[Downloading track]", INFO_COLUMN_WIDTH)), trackName);

  let metadataPath = fsPath.join(path, METADATA_FILE);
  if (!metadata) {
    metadata = getMetadata(metadataPath);
  }

  if (isTrackDownloaded(track.id, metadata)) {
    warn(logger, `Media is already downloaded`);
    return throughStream();
  }

  let downloadFunction = format === 'video' ? downloadYoutubeVideo : downloadYoutubeAudio;
  return downloadFunction(trackName, path, { quality, logger })
    .map(() => updateMetadata(track, metadata))
    .map(() => saveMetadata(metadata, metadataPath));
}

////
// DOWNLOAD
////

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
    .errors(err => handleDownloadError(err, logger))
    .flatMap(video => highland((push, next) => {
      if (!video) {
        warn(logger, `Video not found!`);
        push(null, highland.nil);
        return throughStream();
      }

      let downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
      debug(logger, `Download from: ${downloadUrl}`);
      debug(logger, `Download to  : ${fullPath}`);

      let writeStream = fs.createWriteStream(fullPath);
      let videoStream = ytdl(downloadUrl, { quality });

      return highland(videoStream)
        .pipe(writeStream)
        .on('finish', () => {
          debug(logger, 'Finish write:', name);
          push(null, fullPath);
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
  const fullPath = fsPath.join(location, `${createFolderName(name)}.mp3`);
  // setup folders
  if (!fs.existsSync(location))
    mkdirp.sync(location);

  return highland(youtube.searchMusicAudio(name, { logger }))
    .flatMap(video => highland((push, next) => {
      if (!video) {
        warn(logger, `Audio not found!`);
        push(null, highland.nil);
        return throughStream();
      }

      let downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
      debug(logger, `Download from: ${downloadUrl}`);
      debug(logger, `Download to  : ${fullPath}`);

      let writeStream = fs.createWriteStream(fullPath);
      let videoStream = ytdl(downloadUrl, {
        quality: 140, // M4A AAC 128 kbps
        filter: 'audioonly'
      });

      return highland(videoStream)
        .errors(err => push(err))
        .pipe(writeStream)
        .on('finish', () => {
          debug(logger, 'Finish write:', name);
          push(null, fullPath);
          push(null, highland.nil);
        });
    }));
}

////
// METADATA FILE MANIPULATION
////

function isTrackDownloaded(trackId, metadata) {
  metadata = getMetadata(metadata);
  return metadata.ids.indexOf(trackId) !== -1;
}

function updateMetadata(track, metadata) {
  metadata = getMetadata(metadata);
  let fileName = `${track.artists[0].name} - ${track.name}`;

  // update downloaded tracks control
  metadata.ids.push(track.id);
  // info for humans to understand the metadata file
  metadata.names[track.id] = fileName;

  return metadata;
}

/**
 * Get metadata object.
 * Read from file if the parameter is a path.
 * 
 * @param {String|Object} pathOrData if it's a string, will read the metadata file on this exact location. If object, return it
 */
function getMetadata(pathOrData) {
  if (typeof pathOrData === 'string')
    return metadata = loadMetadata(pathOrData);
  return pathOrData;
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

////
// HELPERS
////

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