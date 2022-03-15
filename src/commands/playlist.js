const leftPad = require('left-pad');
const fsPath = require('path');
const chalk = require('chalk');
const highland = require('highland');

const youtube = require('../youtube_search');
const spotify = require('../spotify');
const { INFO_COLUMN_WIDTH, info } = require('../log');
const { loadMetadata, isTrackDownloaded } = require('../metadata');
const { createFolderName } = require('../create-folder-name');
const { downloadTrack } = require('../download');
const { logDownloadError } = require('./commons');

module.exports = { cmd_playlist, cmd_user };

function cmd_playlist(
  playlists,
  {
    spotifyClientId,
    spotifyClientSecret,
    youtubeKey,
    format,
    quality,
    output,
    flat,
    logger,
  } = {}
) {
  return new Promise((resolve, reject) => {
    spotify
      .login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(() => {
        highland(playlists)
          .flatMap(playlist =>
            highland(spotify.getPlaylist(playlist, { logger }))
          )
          .flatMap(playlist =>
            downloadPlaylist(playlist, {
              format,
              quality,
              path: output,
              createSubFolder: !flat,
              logger,
            })
          )
          .errors(err => logDownloadError(err, logger))
          .done(resolve);
      });
  });
}

function cmd_user(
  username,
  {
    spotifyClientId,
    spotifyClientSecret,
    youtubeKey,
    format,
    quality,
    output,
    flat,
    logger,
  } = {}
) {
  return new Promise((resolve, reject) => {
    spotify
      .login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(function () {
        return downloadUserPlaylists(username, {
          format,
          quality,
          path: output,
          createSubFolder: !flat,
          logger,
        })
          .errors(err => logDownloadError(err, logger))
          .done(resolve);
      });
  });
}

/**
 * Download all tracks from the given playlist
 *
 * @param {SpotifyPlaylist} playlist
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
    .filter(track => !isTrackDownloaded(track.id, metadata))
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
  { format, quality, path, createSubFolder = true, logger } = {}
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
