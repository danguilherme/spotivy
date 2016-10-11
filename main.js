const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const youtube = require('./youtube_search');
const SpotifyWebApi = require('spotify-web-api-node');
const async = require('async');
const mkdirp = require('mkdirp');

const config = require('./config.json');

function onInfo(info, format) {
  console.log(`--- downloading "${info.title}" (${format.resolution}) from ${info.author}`);
}

const BASE_VIDEOS_FOLDER = "videos";
const METADATA_FILE = "metadata.json";

// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId: config.spotify.clientId,
  clientSecret: config.spotify.clientSecret
});

// Retrieve an access token.
spotifyApi.clientCredentialsGrant()
  .then(function (data) {
    console.log('The access token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + data.body['access_token']);

    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);

    onSpotifyReady();
  }, function (err) {
    console.log('Something went wrong when retrieving an access token', err);
  });

function onSpotifyReady() {
  // Get a user's playlists
  spotifyApi.getUserPlaylists('danguilherme')
    .then(function (data) {
      return [data.body.items[1]];
    })
    .then(function (playlists) {
      async.each(
        playlists,
        (playlist, done) => downloadPlaylistVideos(playlist).then(done));
    });
}

function downloadPlaylistVideos(playlist) {
  return new Promise(function (resolve, reject) {
    console.log("[Downloading playlist]", playlist.name);

    // create playlist folder
    let videoPath = path.join(BASE_VIDEOS_FOLDER, createFolderName(playlist.name));
    let metadataPath = path.join(videoPath, METADATA_FILE);

    if (!fs.existsSync(videoPath))
      mkdirp.sync(videoPath);
    if (!fs.existsSync(metadataPath))
      fs.writeFileSync(metadataPath, JSON.stringify({
        ids: []
      }, null, 2));

    let metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    // Get tracks in a playlist
    spotifyApi.getPlaylistTracks('danguilherme', playlist.id, {
        'offset': 1,
        // 'limit': 5,
        'fields': 'items'
      })
      .then(function (data) {
        let tracks = data.body.items;
        return tracks.filter(item => {
          return metadata.ids.indexOf(item.track.id) == -1;
        });
      })
      .then(function (tracks) {
          async.eachSeries(
            tracks,
            function iteratee(track, done) {
              let name = `${track.track.artists[0].name} - ${track.track.name}`;

              console.log("   [Downloading track]", name);

              youtube.searchMusicVideo(name)
                .then(video => {
                  if (!video) {
                    done();
                    return;
                  }

                  ytdl(`https://www.youtube.com/watch?v=${video.id.videoId}`, {
                      quality: 18
                    })
                    .on('info', onInfo)
                    .pipe(fs.createWriteStream(path.join(videoPath, `${createFolderName(name)}.mp4`)))
                    .on('finish', _ => {
                      metadata.ids.push(track.track.id);
                      done(null);
                    });
                });
            },
            function callback(err) {
              if (err) {
                reject(err);
                return;
              };

              fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
              resolve();
            });
        },
        function (err) {
          console.log('Something went wrong!', err);
          reject(err);
        });
  });
}

function createFolderName(name) {
  return name.replace(/[\\\/]/gi, '-');
}