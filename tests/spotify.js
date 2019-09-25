import test from 'ava';
import config from '../config.json';
import spotify from '../spotify';
import caporal from "caporal";
import { isStream } from "highland";

const logger = caporal.logger();

test('Should login', async t => {
  await t.notThrowsAsync(async () => await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");
});

test('Should find single track', async t => {
  const trackId = '6yECpoXqqn0cJYl5zC9Gwy';
  let track;

  await t.notThrowsAsync(async () => await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");

  await t.notThrowsAsync(async () => {
    track = await spotify.getTrack(trackId, { logger });
  }, "Downloads the track");

  t.is(track.id, trackId, "id matches");
  t.is(track.name, 'Brilha La Luna', "name matches");
  t.is(track.type, 'track', "type matches");
  t.is(track.artists[0].id, '7oCPozHYsiILeiQlma8EEj', "artist[0].id matches");
  t.is(track.artists[0].name, 'Rouge', "artist[0].name matches");
  t.is(track.artists[0].type, 'artist', "artist[0].type matches");
});

test('Should find playlist', async t => {
  const username = 'danguilherme';
  const playlistId = '1IWxwXxIPGHDRmKbMCtqFf';
  let playlist;

  await t.notThrowsAsync(async () => await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");

  await t.notThrowsAsync(async () => {
    playlist = await spotify.getPlaylist(username, playlistId, { logger });
  }, "Downloads the playlist");

  t.is(playlist.owner.id, username, "owner.id matches");
  t.is(playlist.id, playlistId, "id matches");
  t.is(playlist.name, 'The Greatest Showman (Original Motion Picture Soundtrack)', "name matches");
  t.is(playlist.type, 'playlist', "name matches");
  t.is(playlist.tracks.total, 11, "tracks count matches");
});

test('Should find all playlists from a user', async t => {
  const username = 'danguilherme';
  let playlist;

  await t.notThrowsAsync(async () => await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");

  await t.notThrowsAsync(async () => {
    playlist = await spotify.getAllUserPlaylists(username, { logger });
  }, "Downloads the playlist");

  t.true(isStream(playlist));
  // t.is(playlist.owner.id, username, "owner.id matches");
  // t.is(playlist.id, playlistId, "id matches");
  // t.is(playlist.name, 'The Greatest Showman (Original Motion Picture Soundtrack)', "name matches");
  // t.is(playlist.type, 'playlist', "name matches");
  // t.is(playlist.tracks.total, 11, "tracks count matches");
});