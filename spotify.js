const SpotifyWebApi = require('spotify-web-api-node');
const async = require('async');
const config = require('./config.json');

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
  return new Promise(function (resolve, reject) {
    let totalItems = null;
    let offset = 0;
    let playlists = [];

    login().then(api => {
      async.doWhilst(
        function iteratee(done) {
          api.getUserPlaylists('danguilherme', {
              limit: 20,
              offset: offset
            })
            .then(data => {
              totalItems = data.body.total;
              offset += 20;

              playlists = playlists.concat(data.body.items);
              done();
            })
            .catch(err => done(err));
        },
        function test() {
          return playlists.length < totalItems;
        },
        function callback(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(playlists);
        });
    });
  })
}

function getAllPlaylistTracks(username, playlistId) {
  // TODO: use streams to handle the pages as they come
  return new Promise(function (resolve, reject) {
    let totalItems = null;
    let offset = 0;
    let tracks = [];

    login().then(api => {
      async.doWhilst(
        function iteratee(done) {
          api.getPlaylistTracks(username, playlistId, {
              limit: 20,
              offset: offset
            })
            .then(data => {
              totalItems = data.body.total;
              offset += 20;

              tracks = tracks.concat(data.body.items);
              done();
            })
            .catch(err => done(err));
        },
        function test() {
          return tracks.length < totalItems;
        },
        function callback(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(tracks);
        });
    });
  });
}

module.exports = {
  getAllUserPlaylists,
  getAllPlaylistTracks
};