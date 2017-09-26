#!/usr/bin/env node

const fs = require('fs');
const fsPath = require('path');
const ytdl = require('ytdl-core');
const mkdirp = require('mkdirp');
const chalk = require('chalk');
const highland = require('highland');
const args = require('args');

const pkg = require('./package.json');
const youtube = require('./youtube_search');
const spotify = require('./spotify');
const config = require('./config.json');
const debug = require('./debug');

const METADATA_FILE = ".downloaded";

args
  .option('output', 'Location where to save the downloaded videos', './tracks')
  .option('format', "The format of the file to download. Either 'audio' or 'video'", 'video')
  .option('audio', 'Download as audio', false)
  .option('debug', 'Show exagerated logs', false);

// load config from command prompt args
Object.assign(config, args.parse(process.argv));
if (config.audio) config.format = 'audio';
if (config.debug) process.env.spotivyDebug = true;


debug(`Loaded options:`, JSON.stringify(config, null, 2));

console.log();
console.log(chalk.bold.green(`[${pkg.name} v${pkg.version}]`),
  `Saving ${config.format === 'video' ? 'videos' : 'audios'} to "${config.output}"`);
console.log();

spotify.login().then(function () {
  return downloadUserPlaylists(config.spotify.username, config);
})

function downloadUserPlaylists(username, options = {}) {
  let { format, output: path } = options;
  let currentMetadata = null;
  let currentMetadataPath = null;
  let currentPlaylist = null;
  let currentPath = null;

  spotify
    .getAllUserPlaylists(username)
    .sequence()
    .flatMap(playlist => {
      currentPlaylist = playlist;
      currentPath = fsPath.join(path, createFolderName(currentPlaylist.name));
      currentMetadataPath = fsPath.join(currentPath, METADATA_FILE);
      currentMetadata = loadMetadata(currentMetadataPath);


      console.log(chalk.bold.blue("[Downloading playlist]"), currentPlaylist.name);
      return spotify.getAllPlaylistTracks(currentPlaylist.owner.id, currentPlaylist.id);
    })
    .sequence()
    .map(playlistTrack => playlistTrack.track)
    // skip downloaded songs
    .filter(track => {
      let shouldDownload = !isTrackDownloaded(track.id, currentMetadata);
      if (!shouldDownload) debug(`Skip "${track.name}"`);
      return shouldDownload;
    })
    .flatMap(track => {
      console.log(chalk.bold.blue("   [Downloading track]"), track.name);

      const downloadPromise = downloadTrack(track, { format, path: currentPath });
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
function downloadTrack(track, { format = 'video', path = './' } = {}) {
  let fileName = `${track.artists[0].name} - ${track.name}`;
  let metadataPath = fsPath.join(path, METADATA_FILE);

  let downloadFunction = format === 'video' ? downloadYoutubeVideo : downloadYoutubeAudio;
  return downloadFunction(fileName, path)
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
function downloadYoutubeVideo(name, location = './') {
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
        debug(`Downloading video from url: ${downloadUrl}`);

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
function downloadYoutubeAudio(name, location = './') {
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
        debug(`Downloading audio from url: ${downloadUrl}`);

        ytdl(downloadUrl, {
          filter: function (f) {
            if (!f.type) return false;

            let [, typeAndFormat, type, format, codec] = formatTypeRegex.exec(f.type);
            let shouldDownload = type === 'audio' && format === 'mp4';

            if (shouldDownload) debug(`File type: ${typeAndFormat} (${codec})`);

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