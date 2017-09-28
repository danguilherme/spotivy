const SpotifyWebApi = require('spotify-web-api-node');
const highland = require('highland');

let api = null;

function login(clientId, clientSecret, { logger } = {}) {
  return new Promise(function (resolve, reject) {
    if (!!api) {
      resolve(api);
      return;
    }

    if (logger)
      logger.debug(`Spotify login`);

    api = new SpotifyWebApi({ clientId, clientSecret });

    // Retrieve an access token.
    api.clientCredentialsGrant()
      .then(function (data) {
        // Save the access token so that it's used in future calls
        api.setAccessToken(data.body['access_token']);

        resolve(api);
      }, function (err) {
        console.error('Something went wrong when retrieving an access token', err);
        reject(err);
      });
  })
}

function getAllUserPlaylists(username, { logger } = {}) {
  if (logger)
    logger.debug(`Fetching playlists of ${username}`);
  return createPaginationStream(function getPlaylistTracks() {
    return api.getUserPlaylists(username);
  }, { logger });
}

function getAllPlaylistTracks(username, playlistId, { logger } = {}) {
  if (logger)
    logger.debug(`Fetching playlist tracks (${playlistId})`);
  return createPaginationStream(function getPlaylistTracks() {
    return api.getPlaylistTracks(username, playlistId);
  }, { logger });
}

function createPaginationStream(endpointFn, { logger } = {}) {
  let offset = 0;
  let limit = 20;
  let totalItemsCount = undefined;
  let loadedItemsCount = 0;

  return highland(function (push, next) {
    if (logger) {
      if (loadedItemsCount === 0)
        logger.debug(`Fetch paginated: "${endpointFn.name}"`);
      logger.debug(`Fetch paginated: loading ${offset}..${offset + limit}`);
    }

    endpointFn({
      limit: limit,
      offset: offset
    })
      .then(data => {
        offset += limit;
        totalItemsCount = data.body.total;
        loadedItemsCount += data.body.items.length;

        if (logger) {
          logger.debug(`Fetch paginated: loaded  ${loadedItemsCount}/${totalItemsCount}`);
          logger.debug(`Fetch paginated: pushing down the stream`);
        }

        // put the items down to the stream
        push(null, data.body.items);

        if (loadedItemsCount >= totalItemsCount) {
          if (logger)
            logger.debug(`Fetch paginated: all finish`);
          push(null, highland.nil);
        } else {
          if (logger)
            logger.debug(`Fetch paginated: continue`);
          next();
        }
      })
      .catch(err => push(err));
  });
}

module.exports = {
  login,
  getAllUserPlaylists,
  getAllPlaylistTracks
};