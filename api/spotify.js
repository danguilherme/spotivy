const { BehaviorSubject } = require('rxjs/BehaviorSubject');
const { Observable } = require('rxjs/Observable');
require('rxjs/add/observable/fromPromise');
const { filter, map, flatMap, catchError, first } = require('rxjs/operators');

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

module.exports = { login, getTrack, getPlaylist };