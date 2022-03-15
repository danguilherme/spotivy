const highland = require('highland');

const youtube = require('../youtube-search');
const spotify = require('../spotify');
const { downloadPlaylist, downloadUserPlaylists } = require('../download');
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
