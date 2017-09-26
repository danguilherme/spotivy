const SpotifyWebApi = require('spotify-web-api-node');
const async = require('async');
const highland = require('highland');
const config = require('./config.json');
const debug = require('./debug');

let api = null;

function login() {
  return new Promise(function (resolve, reject) {
    if (!!api) {
      resolve(api);
      return;
    }

    debug(`Spotify login`);

    api = new SpotifyWebApi({
      clientId: config.spotify.clientId,
      clientSecret: config.spotify.clientSecret
    });

    // Retrieve an access token.
    api.clientCredentialsGrant()
      .then(function (data) {
        // Save the access token so that it's used in future calls
        api.setAccessToken(data.body['access_token']);

        resolve(api);
      }, function (err) {
        console.log('Something went wrong when retrieving an access token', err);
        reject(err);
      });
  })
}

function getAllUserPlaylists(username) {
  debug(`Fetching playlists of ${username}`);
  return createPaginationStream(function getPlaylistTracks() {
    return api.getUserPlaylists(username);
  });
}

function getAllPlaylistTracks(username, playlistId) {
  debug(`Fetching playlist tracks (${playlistId})`);
  return createPaginationStream(function getPlaylistTracks() {
    return api.getPlaylistTracks(username, playlistId);
  });
}

function createPaginationStream(endpointFn) {
  let offset = 0;
  let limit = 20;
  let totalItemsCount = undefined;
  let loadedItemsCount = 0;

  return highland(function (push, next) {
    if (loadedItemsCount === 0)
      debug(`Fetch paginated: "${endpointFn.name}"`);
    debug(`Fetch paginated: loading ${offset}..${offset + limit}`);

    endpointFn({
      limit: limit,
      offset: offset
    })
      .then(data => {
        offset += limit;
        totalItemsCount = data.body.total;
        loadedItemsCount += data.body.items.length;

        debug(`Fetch paginated: loaded  ${loadedItemsCount}/${totalItemsCount}`);
        debug(`Fetch paginated: pushing down the stream`);

        // put the items down to the stream
        push(null, data.body.items);

        if (loadedItemsCount >= totalItemsCount) {
          debug(`Fetch paginated: all finish`);
          push(null, highland.nil);
        } else {
          debug(`Fetch paginated: continue`);
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