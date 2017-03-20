const SpotifyWebApi = require('spotify-web-api-node');
const async = require('async');
const config = require('./config.json');
const debug = require('./debug');

let api = null;

function login() {
  return new Promise(function (resolve, reject) {
    if (!!api) {
      resolve(api);
      return;
    }

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
  // TODO: use streams to handle the pages as they come
  return login()
    .then(api => {
      debug(`Fetching playlists of ${username}`);
      let getUserPlaylists = api.getUserPlaylists.bind(api, username);
      return getAllItemsFromPaginatedEndpoint(getUserPlaylists);
    });
}

function getAllPlaylistTracks(username, playlistId) {
  // TODO: use streams to handle the pages as they come
  return login()
    .then(api => {
      debug(`Fetching tracks from playlist with id '${playlistId}'`);
      let getPlaylistTracks = api.getPlaylistTracks.bind(api, username, playlistId);
      return getAllItemsFromPaginatedEndpoint(getPlaylistTracks)
    });
}

function getAllItemsFromPaginatedEndpoint(endpointFunction) {
  // TODO: use streams to handle the pages as they come
  return new Promise(function (resolve, reject) {
    debug(`Fetching paginated endpoint: "${endpointFunction.name}"`);

    let totalItems = [];
    let totalItemsCount = null;
    let offset = 0;
    let limit = 50;

    async.doWhilst(
      function iteratee(done) {
        endpointFunction({
            limit: limit,
            offset: offset
          })
          .then(data => {
            totalItemsCount = data.body.total;
            offset += limit;

            totalItems = totalItems.concat(data.body.items);

            debug(`Fetch ${totalItems.length}/${totalItemsCount}`);

            done();
          })
          .catch(err => done(err));
      },
      function test() {
        return totalItems.length < totalItemsCount;
      },
      function callback(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(totalItems);
      });
  });
}

module.exports = {
  getAllUserPlaylists,
  getAllPlaylistTracks
};