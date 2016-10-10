const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const youtube = require('./youtube_search');

let m = "Megan Trainor - No";
youtube.searchMusicVideo(m)
  .then(x => {
    ytdl(`https://www.youtube.com/watch?v=${x.id.videoId}`, {
        quality: 18
      })
      .on('info', onInfo)
      .pipe(fs.createWriteStream(path.join('videos', `${m}.mp4`)))
  })

function onInfo(info, format) {
  console.log(`Downloading "${info.title}" (${format.resolution}) from ${info.author}`);
  console.log(format);
}