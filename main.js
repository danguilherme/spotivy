const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const async = require('async');
const mkdirp = require('mkdirp');
const youtube = require('./youtube_search');
const spotify = require('./spotify');
const config = require('./config.json');

const BASE_VIDEOS_FOLDER = "videos";
const METADATA_FILE = ".downloaded";

spotify
  .getAllUserPlaylists(config.spotify.username)
  .then(downloadPlaylists)
  .catch(err => console.error(err));

function downloadPlaylists(playlists) {
  return new Promise(function (resolve, reject) {
    async.eachSeries(
      playlists,
      function iteratee(playlist, done) {
        console.log("[Downloading playlist]", playlist.name);

        spotify
          .getAllPlaylistTracks(playlist.owner.id, playlist.id)
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

/**
 * Also checks if the video isn't already downloaded.
 * 
 * @param {SpotifyPlaylist} playlist
 * @param {Array} tracks
 * @returns
 */
function downloadPlaylistTracks(playlist, tracks) {
  let videoPath = path.join(BASE_VIDEOS_FOLDER, createFolderName(playlist.name));
  let metadataPath = path.join(videoPath, METADATA_FILE);

  let metadata = loadMetadata(metadataPath);

  // remove tracks that are already downloaded from the list
  tracks = tracks.filter(item => metadata.ids.indexOf(item.track.id) == -1)

  return new Promise(function (resolve, reject) {
    async.eachSeries(
      tracks,
      function iteratee(track, done) {
        let name = `${track.track.artists[0].name} - ${track.track.name}`;

        console.log("   [Downloading track]", name);

        downloadYoutubeVideo(name, videoPath)
          .then(_ => {
            // update downloaded tracks control
            metadata.ids.push(track.track.id);
            saveMetadata(metadata, metadataPath);

            done();
          })
          .catch(err => {
            console.error("     [Download failed]", err);
            done();
          });
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

/**
 * Downloads the given video from YouTube.
 *
 * @param {string} name The name of the video to look for
 * @param {string} [location='./'] Where the video file should be saved
 * @returns {PromiseLike}
 */
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

function loadMetadata(location) {
  if (!fs.existsSync(location))
    saveMetadata({
      ids: []
    }, location);

  return JSON.parse(fs.readFileSync(location, 'utf-8'));
}

function saveMetadata(metadata, location) {
  if (!fs.existsSync(location))
    mkdirp.sync(path.dirname(location));
  fs.writeFileSync(location, JSON.stringify(metadata, null, 2));
}

/**
 * Transform the given string to a folder-friendly name for windows
 *
 * @param {string} name
 * @returns {string} the modified name
 */
function createFolderName(name) {
  return name
    .replace(/[\\\/]/gi, '-')
    .replace(/"/gi, "'")
    .replace(/\?/gi, "");
}