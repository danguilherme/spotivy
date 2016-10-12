const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const youtube = require('./youtube_search');
const SpotifyWebApi = require('spotify-web-api-node');
const async = require('async');
const mkdirp = require('mkdirp');

const config = require('./config.json');
const spotify = require('./spotify');

function onInfo(info, format) {
  console.log(`--- downloading "${info.title}" (${format.resolution}) from ${info.author}`);
}

const BASE_VIDEOS_FOLDER = "videos";
const METADATA_FILE = "metadata.json";






spotify
  .getAllUserPlaylists('danguilherme')
  .then(downloadPlaylists)
  // .then(playlists => spotify.getAllPlaylistTracks('danguilherme', playlists[0].id))
  // .then(tracks => console.log(tracks.length))
  .catch(err => console.error(err));

function downloadPlaylists(playlists) {
  return new Promise(function (resolve, reject) {
    async.eachSeries(
      playlists,
      function iteratee(playlist, done) {
        console.log("[Downloading playlist]", playlist.name);

        spotify
          .getAllPlaylistTracks('danguilherme', playlists[0].id)
          .then(tracks => downloadPlaylistTracks(playlist, tracks))
          .then(_ => done());
      },
      function callback(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    )
  });
}

function downloadPlaylistTracks(playlist, tracks) {
  return new Promise(function (resolve, reject) {
    async.eachSeries(
      tracks,
      function iteratee(track, done) {
        let name = `${track.track.artists[0].name} - ${track.track.name}`;

        console.log("   [Downloading track]", name);

        let videoPath = path.join(BASE_VIDEOS_FOLDER, createFolderName(playlist.name));
        downloadYoutubeVideo(name, videoPath)
          .then(_ => done());
      },
      function callback(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    )
  });
}

function downloadYoutubeVideo(name, location = './') {
  return new Promise(function (resolve, reject) {
    // setup folders
    if (!fs.existsSync(location))
      mkdirp.sync(location);

    youtube.searchMusicVideo(name)
      .then(video => {
        if (!video) {
          reject("Video não encontrado");
          return;
        }

        ytdl(`https://www.youtube.com/watch?v=${video.id.videoId}`, {
            quality: 18 // 360p
          })
          // .on('info', onInfo)
          .pipe(fs.createWriteStream(path.join(location, `${createFolderName(name)}.mp4`)))
          .on('finish', _ => {
            resolve({
              path: path.join(location, `${createFolderName(name)}.mp4`),
              video
            });
          });
      });
  })
}

function createFolderName(name) {
  return name.replace(/[\\\/]/gi, '-');
}