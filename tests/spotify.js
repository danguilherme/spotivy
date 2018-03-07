import test from 'ava';
import config from '../config.json';
import spotify from '../spotify';
import caporal from "caporal";

const logger = caporal.logger();

test('Should login', async t => {
  await t.notThrows(async () => await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");
});

test('Should find single track', async t => {
  const trackId = '6yECpoXqqn0cJYl5zC9Gwy';
  let track;
  await t.notThrows(async () => await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");

  await t.notThrows(async () => {
    track = await spotify.getTrack(trackId, { logger });
  }, "Downloads the track");

  t.is(track.id, trackId, "id matches");
  t.is(track.name, 'Brilha La Luna', "name matches");
  t.is(track.type, 'track', "type matches");
  t.is(track.artists[0].id, '7oCPozHYsiILeiQlma8EEj', "artist[0].id matches");
  t.is(track.artists[0].name, 'Rouge', "artist[0].name matches");
  t.is(track.artists[0].type, 'artist', "artist[0].type matches");
});