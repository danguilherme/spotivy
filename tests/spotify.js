import test from 'ava';
import config from '../config.json';
import spotify from '../spotify';
import caporal from "caporal";

const logger = caporal.logger();

test.skip('Should login', async t => {
  await t.notThrows(login(config.spotify.clientId, config.spotify.clientSecret, { logger }), "Login performs sucessfully");
});

test('Should find single track', async t => {
  const trackId = '6yECpoXqqn0cJYl5zC9Gwy';
  await spotify.login(config.spotify.clientId, config.spotify.clientSecret, { logger });
  console.log(await spotify.getTrack(trackId, { logger }));
  await t.deepEqual(await spotify.getTrack(trackId, { logger }), {
    id: trackId,
    name: 'Brilha La Luna',
    type: 'track',
    artists:
      [{
        id: '7oCPozHYsiILeiQlma8EEj',
        name: 'Rouge',
        type: 'artist',
      }]
  }, "Downloads the track");
})