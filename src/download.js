const leftPad = require('left-pad');
const fs = require('fs');
const fsPath = require('path');
const ytdl = require('ytdl-core');
const mkdirp = require('mkdirp');
const chalk = require('chalk');
const highland = require('highland');

const spotify = require('./spotify');
const youtube = require('./youtube-search');
const {
  INFO_COLUMN_WIDTH,
  info,
  debug,
  warn,
  subtext,
  fadedTextColor,
} = require('./log');
const { throughStream } = require('./stream-helpers');
const {
  updateMetadata,
  saveMetadata,
  loadMetadata,
  isTrackDownloaded,
} = require('./metadata');
const { createFolderName } = require('./create-folder-name');

module.exports = { downloadTrack, downloadPlaylist, downloadUserPlaylists };

/**
 * Download the specified track on disk
 *
 * @param {SpotifyApi.TrackObjectSimplified} track
 * @param {Object} options
 * - format: `video` or `audio`
 * - path: where the track will be saved on disk
 */
function downloadTrack(
  track,
  { format = 'video', quality, path = './', logger, metadata } = {}
) {
  const trackName = `${track.artists[0].name} - ${track.name}`;
  info(
    logger,
    chalk.bold.blue(leftPad('[Downloading track]', INFO_COLUMN_WIDTH)),
    trackName
  );

  if (!metadata) {
    metadata = loadMetadata(path);
  }

  if (isTrackDownloaded(track.id, metadata)) {
    subtext(logger, `Media is already downloaded`);
    return throughStream();
  }

  let downloadFunction =
    format === 'video' ? downloadYoutubeVideo : downloadYoutubeAudio;
  return downloadFunction(trackName, path, { quality, logger })
    .map(() => updateMetadata(track, metadata))
    .map(() => saveMetadata(metadata, path));
}

/**
 * Download all tracks from the given playlist
 *
 * @param {SpotifyApi.PlaylistBaseObject} playlist
 * @param {*} param1
 */
function downloadPlaylist(
  playlist,
  {
    format = 'video',
    quality,
    path = './',
    createSubFolder = true,
    logger,
  } = {}
) {
  info(
    logger,
    chalk.bold.blue(leftPad('[Downloading playlist]', INFO_COLUMN_WIDTH)),
    playlist.name
  );

  let targetPath = path;
  if (createSubFolder)
    targetPath = fsPath.join(path, createFolderName(playlist.name));
  const metadata = loadMetadata(targetPath);

  return spotify
    .getAllPlaylistTracks(playlist.id, { logger })
    .sequence()
    .map(playlistTrack => playlistTrack.track)
    .flatMap(track =>
      downloadTrack(track, {
        format,
        quality,
        path: targetPath,
        logger,
        metadata,
      })
    );
}

function downloadUserPlaylists(
  username,
  { format, quality, path, createSubFolder = true, logger }
) {
  if (createSubFolder) path = fsPath.join(path, createFolderName(username));

  return spotify
    .getAllUserPlaylists(username, { logger })
    .sequence()
    .flatMap(playlist =>
      downloadPlaylist(playlist, {
        format,
        quality,
        path,
        createSubFolder,
        logger,
      })
    );
}

/**
 * Downloads the given video from YouTube.
 *
 * @param {string} name The name of the video to look for
 * @param {string} [location='./'] Where the video file should be saved
 * @returns {Highland.Stream}
 */
function downloadYoutubeVideo(
  name,
  location = './',
  { quality = 'highest', logger = undefined } = {}
) {
  let fullPath = fsPath.join(location, `${createFolderName(name)}.mp4`);
  // setup folders
  if (!fs.existsSync(location)) mkdirp.sync(location);

  let videoSearchPromise = youtube.searchMusicVideo(name, { logger });

  return highland(videoSearchPromise) // search the video
    .flatMap(video =>
      highland((push, next) => {
        if (!video) {
          warn(logger, `Video not found!`);
          push(null, highland.nil);
          return throughStream();
        }

        const downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
        debug(logger, `Download from: ${downloadUrl}`);
        debug(logger, `Download to  : ${fullPath}`);

        const writeStream = fs.createWriteStream(fullPath);
        const videoStream = ytdl(downloadUrl, { quality });

        logVideoDownloadProgress(videoStream);

        return highland(videoStream)
          .errors(err => push(err))
          .pipe(writeStream)
          .on('finish', () => {
            debug(logger, 'Finish write:', name);
            push(null, fullPath);
            push(null, highland.nil);
          });
      })
    );
}

/**
 * Downloads the audio from the given video from YouTube.
 *
 * @param {string} name The name of the video to look for
 * @param {string} [location='./'] Where the audio file should be saved
 * @returns {Highland.Stream}
 */
function downloadYoutubeAudio(
  name,
  location = './',
  { logger = undefined } = {}
) {
  const fullPath = fsPath.join(location, `${createFolderName(name)}.mp3`);
  // setup folders
  if (!fs.existsSync(location)) mkdirp.sync(location);

  return highland(youtube.searchMusicAudio(name, { logger })).flatMap(video =>
    highland((push, next) => {
      if (!video) {
        warn(logger, `Audio not found!`);
        push(null, highland.nil);
        return throughStream();
      }

      const downloadUrl = `https://www.youtube.com/watch?v=${video.id.videoId}`;
      debug(logger, `Download from: ${downloadUrl}`);
      debug(logger, `Download to  : ${fullPath}`);

      const writeStream = fs.createWriteStream(fullPath);
      const videoStream = ytdl(downloadUrl, {
        quality: 140, // M4A AAC 128 kbps
        filter: 'audioonly',
      });

      logVideoDownloadProgress(videoStream);

      return highland(videoStream)
        .errors(err => push(err))
        .pipe(writeStream)
        .on('finish', () => {
          debug(logger, 'Finish write:', name);
          push(null, fullPath);
          push(null, highland.nil);
        });
    })
  );
}

function trackVideoDownload(videoStream, events) {
  videoStream.on('response', function (response) {
    const totalSize = response.headers['content-length'];
    let dataRead = 0;
    response.on('data', function (data) {
      dataRead += data.length;
      const percent = dataRead / totalSize;

      events.onProgressChanged({
        total: totalSize,
        read: dataRead,
        percent,
      });
    });
    response.on('end', function () {
      events.onEnd();
    });
  });
}

function logVideoDownloadProgress(videoStream) {
  const leftMargin = leftPad('', INFO_COLUMN_WIDTH);
  const resetLine = () => {
    process.stdout.cursorTo(0);
    process.stdout.clearLine(1);
  };
  const print = message => {
    resetLine();
    process.stdout.write(`${leftMargin} ${fadedTextColor(message)} `);
  };

  print('Preparing download...');
  trackVideoDownload(videoStream, {
    onProgressChanged: function (data) {
      const { percent } = data;
      print(`${(percent * 100).toFixed().padStart(3)}%`);
    },
    onEnd: function () {
      resetLine();
    },
  });
}
