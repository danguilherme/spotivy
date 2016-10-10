const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const youtube = require('./youtube_search');

const config = require('./config.json');

function onInfo(info, format) {
  console.log(`--- downloading "${info.title}" (${format.resolution}) from ${info.author}`);
  console.log(format);
}


var SpotifyWebApi = require('spotify-web-api-node');

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
      return [data.body.items[3]];
    })
    .then(function (playlists) {
      playlists.forEach(downloadPlaylistVideos);
    });
}

function downloadPlaylistVideos(playlist) {
  console.log("[Donwloading playlist]", playlist.name);

  // Get tracks in a playlist
  spotifyApi.getPlaylistTracks('danguilherme', playlist.id, {
      'offset': 1,
      // 'limit': 5,
      'fields': 'items'
    })
    .then(function (data) {
      data.body.items.forEach(track => {
        let name = `${track.track.artists[0].name} - ${track.track.name}`;

        console.log("   [Downloading track]", name);
        youtube.searchMusicVideo(name)
          .then(video => {
            ytdl(`https://www.youtube.com/watch?v=${video.id.videoId}`, {
                quality: 18
              })
              .on('info', onInfo)
              .pipe(fs.createWriteStream(path.join('videos', `${createFolderName(name)}.mp4`)))
          });
      });
    }, function (err) {
      console.log('Something went wrong!', err);
    });
}

function createFolderName(name) {
  return name.replace(/[\\\/]/gi, '-');
}