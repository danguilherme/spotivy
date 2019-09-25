import { BehaviorSubject, defer, Observable, from, of } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';
import SpotifyWebApi from 'spotify-web-api-node';

import { debug } from '../log';

let api: SpotifyWebApi = undefined;
const accessToken$ = new BehaviorSubject<string | null>(null);

function login(clientId, clientSecret, { logger } = { logger: undefined }) {
  return new Promise(function(resolve, reject) {
    if (!!api) {
      resolve(api);
      return;
    }

    debug(logger, `Spotify login`);

    api = new SpotifyWebApi({ clientId, clientSecret });

    // Retrieve an access token.
    api.clientCredentialsGrant().then(
      function(data) {
        // Save the access token so that it's used in future calls
        api.setAccessToken(data.body['access_token']);

        resolve(api);
      },
      function(err) {
        console.error(
          'Something went wrong when retrieving an access token',
          err,
        );
        reject(err);
      },
    );
  });
}

type Config = { clientId: string; clientSecret: string };
function getAccessToken(
  { clientId, clientSecret }: Config,
  { logger } = { logger: undefined },
): Observable<string> {
  return defer(() => {
    const api = new SpotifyWebApi({ clientId, clientSecret });

    return api.clientCredentialsGrant();
  }).pipe(map(response => response.body.access_token));
}

function getApi(
  config: Config,
  { logger } = { logger: undefined },
): Observable<SpotifyWebApi> {
  return from(accessToken$).pipe(
    switchMap(token =>
      !token ? getAccessToken(config, { logger }) : of(token),
    ),
    map(token => new SpotifyWebApi({ ...config, accessToken: token })),
  );
}

function getPlaylist(
  config: Config,
  username: string,
  playlistId: string,
  { logger } = { logger: undefined },
) {
  return getApi(config, { logger }).pipe(
    switchMap(api =>
      defer(() => {
        const method: (
          username: string,
          playlistId: string,
          options?: any,
        ) => Promise<{
          body: SpotifyApi.SinglePlaylistResponse;
        }> = api.getPlaylist.bind(api) as any;
        return method(username, playlistId, { limit: 5 }).then(r => r.body);
      }),
    ),
  );
}

function getPlaylistTracks(
  config: Config,
  username: string,
  playlistId: string,
  { logger } = { logger: undefined },
) {
  return getApi(config, { logger }).pipe(
    switchMap(api =>
      defer(() => {
        const method: (
          username: string,
          playlistId: string,
          options?: any,
        ) => Promise<{
          body: SpotifyApi.PlaylistTrackResponse;
        }> = api.getPlaylistTracks.bind(api) as any;
        return method(username, playlistId, { limit: 5 }).then(r => r.body);
      }),
    ),
  );
}
// https://open.spotify.com/playlist/37i9dQZF1DWWhBhYl3ZMvY?si=YO0hYwfEQqWl20OkVNRRDg
getPlaylistTracks(
  {
    clientId: 'af32ea546bff4ef9a2409559c472e9e2',
    clientSecret: 'f796840713334cec88f5a22b0d3d685f',
  },
  'spotify',
  '37i9dQZF1DWWhBhYl3ZMvY',
)
  .pipe(
    tap(r => console.log(`${r.limit}/${r.total}`, r.offset)),
    map(r => r.items),
  )
  .subscribe(console.log, console.error, console.info);
