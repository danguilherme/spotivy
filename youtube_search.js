const config = require('./config.json');
const Youtube = require('youtube-api');
const debug = require('./debug');

Youtube.authenticate({
  type: 'key',
  key: config.youtube.key
});



function searchVideo(term) {
  return new Promise(function (resolve, reject) {
    debug(`Searching for video: "${term}"`);

    Youtube.search.list({
      part: 'snippet',
      maxResults: 20, // results per page
      q: term,
      type: 'video'
    }, (err, results) => {
      if (err) {
        reject(err);
        return;
      }

      debug(`${results.items.length} item(s) returned`);
      resolve(results.items);
    });
  });
}

function searchMusicVideo(term) {
  return searchVideo(term)
    .then(results => {
      let foundVideo;
      let videos = results
        .slice(0, 5) // in the first 5 results...
        .filter(x => contains(x.snippet.channelTitle, 'VEVO') ||
          contains(x.snippet.channelTitle.toLowerCase(), 'official') ||
          contains(x.snippet.title.toLowerCase(), 'official'));
      if (videos.length) {
        debug(`${videos.length} of the videos are good results:\n\t` +
          videos.map(x => `"${x.snippet.title}", by ${x.snippet.channelTitle}`).join(',\n\t'));

        // if found a good result (VEVO, official video, ...)
        foundVideo = videos[0];
      } else {
        debug(`None of the videos is considered a good result`);
        // if not, return the first match
        foundVideo = results[0];
      }

      debug(`Returning first: "${foundVideo.snippet.title}", by ${foundVideo.snippet.channelTitle}`);
      return foundVideo;
    })
    .catch(x => console.error(x));
}

function searchMusicAudio(term) {
  return searchVideo(`${term} audio`)
    .then(results => {
      debug(`Returning first: "${results[0].snippet.title}", by ${results[0].snippet.channelTitle}`);
      return results[0];
    })
    .catch(x => console.error(x));
}

function contains(string, content) {
  return !!(~(string || "").indexOf(content));
}

module.exports = {
  searchVideo,
  searchMusicVideo,
  searchMusicAudio
};