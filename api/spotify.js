const { BehaviorSubject } = require('rxjs/BehaviorSubject');
const { Observable } = require('rxjs/Observable');
const { filter } = require('rxjs/operators');

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
  const track = new Observable(observer => {
    credentials.subscribe(api => {
      api.getTrack(trackId).then(r => {
        observer.next(r.body);
        observer.complete();
      }, e => observer.error(e));
    });

    return { unsubscribe() { } }
  });
  return track;
}

module.exports = { login, getTrack };