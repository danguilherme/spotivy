const highland = require('highland');

const youtube = require('../youtube-search');
const spotify = require('../spotify');
const { downloadTrack } = require('../download');
const { logDownloadError } = require('./commons');

module.exports = { cmd_track };

function cmd_track(
  tracks,
  {
    spotifyClientId,
    spotifyClientSecret,
    youtubeKey,
    format,
    quality,
    output,
    logger,
  } = {}
) {
  return new Promise((resolve, reject) => {
    spotify
      .login(spotifyClientId, spotifyClientSecret, { logger })
      .then(() => youtube.login(youtubeKey))
      .then(() => {
        highland(tracks)
          .flatMap(track => highland(spotify.getTrack(track, { logger })))
          .flatMap(track =>
            highland(
              downloadTrack(track, { format, quality, path: output, logger })
            )
          )
          .errors(err => logDownloadError(err, logger))
          .done(resolve);
      });
  });
}
