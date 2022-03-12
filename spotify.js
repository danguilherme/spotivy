const SpotifyWebApi = require('spotify-web-api-node');
const highland = require('highland');

const { debug, error } = require('./log');

let api = null;

function login(clientId, clientSecret, { logger } = {}) {
  return new Promise(function (resolve, reject) {
    if (!!api) {
      resolve(api);
      return;
    }

    debug(logger, `Spotify login`);

    api = new SpotifyWebApi({ clientId, clientSecret });

    debug(logger, 'Granting credentials...');
    // Retrieve an access token.
    api.clientCredentialsGrant()
      .then(function (data) {
        // Save the access token so that it's used in future calls
        api.setAccessToken(data.body['access_token']);

        debug(logger, 'Spotify login successful');
        resolve(api);
      }, function (err) {
        error(logger, `Something went wrong when retrieving an access token: ${err.message}`);
        debug(logger, `Stack trace:\n${err.stack}`);
        reject(err);
      });
  })
}

function getTrack(trackId, { logger } = {}) {
  debug(logger, `Fetch track: ${trackId}`);
  return api.getTrack(trackId).then(trackResponse => {
    const track = trackResponse.body;
    debug(logger, `Success: ${track.name}`);
    return track;
  });
}

function getPlaylist(playlistId, { logger } = {}) {
  debug(logger, `Fetch playlist: ${playlistId}`);
  return api.getPlaylist(playlistId).then(playlistResponse => {
    const playlist = playlistResponse.body;
    debug(logger, `Success: ${playlist.name}`);
    return playlist;
  });
}

function getAllUserPlaylists(username, { logger } = {}) {
  debug(logger, `Fetching playlists of ${username}`);
  return createPaginationStream(function getPlaylistTracks(options) {
    return api.getUserPlaylists(username, options);
  }, { logger });
}

function getAllPlaylistTracks(playlistId, { logger } = {}) {
  debug(logger, `Fetching playlist tracks (${playlistId})`);
  return createPaginationStream(function getPlaylistTracks(options) {
    return api.getPlaylistTracks(playlistId, options);
  }, { logger });
}

function createPaginationStream(endpointFn, { logger } = {}) {
  let offset = 0;
  let limit = 20;
  let totalItemsCount = undefined;
  let loadedItemsCount = 0;

  return highland(function (push, next) {
    if (loadedItemsCount === 0)
      debug(logger, `Fetch paginated: "${endpointFn.name}"`);
    debug(logger, `Fetch paginated: loading ${offset}..${offset + limit}`);

    endpointFn({ limit, offset })
      .then(data => {
        offset += limit;
        totalItemsCount = data.body.total;
        loadedItemsCount += data.body.items.length;

        debug(logger, `Fetch paginated: loaded  ${loadedItemsCount}/${totalItemsCount}`);
        debug(logger, `Fetch paginated: pushing down the stream`);

        // put the items down to the stream
        push(null, data.body.items);

        if (loadedItemsCount >= totalItemsCount) {
          debug(logger, `Fetch paginated: all finish`);
          push(null, highland.nil);
        } else {
          debug(logger, `Fetch paginated: next page`);
          next();
        }
      })
      .catch(err => push(err));
  });
}

module.exports = {
  login,
  getTrack,
  getPlaylist,
  getAllUserPlaylists,
  getAllPlaylistTracks
};