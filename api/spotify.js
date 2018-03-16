const { BehaviorSubject } = require('rxjs/BehaviorSubject');
const { Observable } = require('rxjs/Observable');
require('rxjs/add/observable/of');
require('rxjs/add/observable/defer');
require('rxjs/add/observable/fromPromise');
const { filter, map, flatMap, catchError, first, takeWhile, } = require('rxjs/operators');

const SpotifyWebApi = require('spotify-web-api-node');
const highland = require('highland');

const Caporal = require('caporal');
const { debug, info } = require('../log');
const logger = Caporal.logger();

let credentials;

function login(clientId, clientSecret, { logger } = {}) {
  if (!!credentials)
    return credentials;

  credentials = new BehaviorSubject()
    .pipe(filter(x => !!x)); // skip first value, which is undefined
  const api = new SpotifyWebApi({ clientId, clientSecret });

  // Retrieve an access token.
  api.clientCredentialsGrant()
    .then(function (data) {
      // Save the access token so that it's used in future calls
      api.setAccessToken(data.body['access_token']);

      credentials.next(api);
    }, function (err) {
      console.error('Something went wrong when retrieving an access token', err);
      credentials.error(err);
    });

  return credentials;
}

function getTrack(trackId, { logger } = {}) {
  return credentials
    .pipe(flatMap(api => Observable.fromPromise(api.getTrack(trackId))))
    .pipe(map(response => response.body))
    .pipe(catchError(e => Observable.just(new Error(e))))
    .pipe(first());
}

function getPlaylist(username, playlistId, { logger } = {}) {
  return credentials
    .pipe(flatMap(api => Observable.fromPromise(api.getPlaylist(username, playlistId))))
    .pipe(map(response => response.body))
    .pipe(catchError(e => Observable.just(new Error(e))))
    .pipe(first());
}

function getUserPlaylists(api, { limit, offset }) {
  return Observable.fromPromise(api.getUserPlaylists(username, { limit, offset }));
}

function getAllUserPlaylists(username, { perPage: limit, logger } = { perPage: 20 }) {
  debug(logger, `Fetching playlists of ${username}`);

  let offset = 0;
  let totalItemsCount = undefined;
  let loadedItemsCount = 0;

  function requestPage(api, limit, offset) {
    return Observable.fromPromise(api.getUserPlaylists(username, { limit, offset }));
  }

  Observable.defer(() => requestPage(api, limit, offset));

  return credentials
    .pipe(flatMap(api => requestPage(api, limit, offset)))
    .pipe(map(data => {
      offset += limit;
      totalItemsCount = data.body.total;
      loadedItemsCount += data.body.items.length;

      debug(logger, `Fetch paginated: loaded  ${loadedItemsCount}/${totalItemsCount}`);
      debug(logger, `Fetch paginated: pushing down the stream`);
      console.log(loadedItemsCount < totalItemsCount);

      return data.body.items;
    }))
    .pipe(takeWhile(x => loadedItemsCount < totalItemsCount))
    .pipe(catchError(e => Observable.of(new Error(e))));
}

login('af32ea546bff4ef9a2409559c472e9e2', 'f796840713334cec88f5a22b0d3d685f').subscribe(() => {
  getAllUserPlaylists('danguilherme', { perPage: 5 })
    .pipe(map(x => x.length))
    .subscribe(console.log);
})

module.exports = { login, getTrack, getPlaylist, getAllUserPlaylists };