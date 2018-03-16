import test from 'ava';
import config from '../config.json';
import spotify from '../api/spotify';
import caporal from "caporal";
import { isStream } from "highland";
import { filter, take, last, first } from "rxjs/operators";

const logger = caporal.logger();

test('should login', async t => {
  let cred;
  await t.notThrows(async () => cred = await login(), "login performs sucessfully");
  t.truthy(cred._credentials, 'credentials are set');
});

test('should find single track', async t => {
  const trackId = '6yECpoXqqn0cJYl5zC9Gwy';
  let track;

  await login();

  await t.notThrows(async () => {
    track = await spotify.getTrack(trackId, { logger }).toPromise();
  }, "Downloads the track");

  t.is(track.id, trackId, "id matches");
  t.is(track.name, 'Brilha La Luna', "name matches");
  t.is(track.type, 'track', "type matches");
  t.is(track.artists[0].id, '7oCPozHYsiILeiQlma8EEj', "artist[0].id matches");
  t.is(track.artists[0].name, 'Rouge', "artist[0].name matches");
  t.is(track.artists[0].type, 'artist', "artist[0].type matches");
});

test('should find playlist', async t => {
  const username = 'danguilherme';
  const playlistId = '1IWxwXxIPGHDRmKbMCtqFf';
  let playlist;

  await login();

  await t.notThrows(async () => {
    playlist = await spotify.getPlaylist(username, playlistId, { logger }).toPromise();
  }, "Downloads the playlist");

  t.truthy(playlist, 'playlist exists');
  t.is(playlist.id, playlistId, "id matches");
  t.is(playlist.owner.id, username, "owner.id matches");
  t.is(playlist.name, 'The Greatest Showman (Original Motion Picture Soundtrack)', "name matches");
  t.is(playlist.type, 'playlist', "name matches");
  t.is(playlist.tracks.total, 11, "tracks count matches");
});

test.skip('Should find all playlists from a user', async t => {
  const username = 'danguilherme';
  let playlist;

  await t.notThrows(async () => await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");

  await t.notThrows(async () => {
    playlist = await spotify.getAllUserPlaylists(username, { logger });
  }, "Downloads the playlist");

  console.log(playlist);

  t.true(isStream(playlist));
  // t.is(playlist.owner.id, username, "owner.id matches");
  // t.is(playlist.id, playlistId, "id matches");
  // t.is(playlist.name, 'The Greatest Showman (Original Motion Picture Soundtrack)', "name matches");
  // t.is(playlist.type, 'playlist', "name matches");
  // t.is(playlist.tracks.total, 11, "tracks count matches");
});

// helpers
async function login() {
  return await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger })
  .pipe(first())
  .toPromise();
}