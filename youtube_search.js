const config = require('./config.json');
const Youtube = require('youtube-api');
const debug = require('./debug');

Youtube.authenticate({
  type: 'key',
  key: config.youtube.key
});



function searchVideo(term) {
  return new Promise(function (resolve, reject) {
    debug(`Search video: search "${term}"`);

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

      debug(`Search video: ${results.items.length} item(s) returned`);
      resolve(results.items);
    });
  });
}

function searchMusicVideo(term) {
  return searchVideo(term)
    .then(results => {
      let foundVideo = results[0];
      let goodResults = results
        .slice(0, 5) // in the first 5 results...
        .filter(isGoodMusicVideoContent);

      if (!goodResults.length) {
        debug(`Search music video: None of the videos is considered a good result`);
      } else {
        debug(`Search music video: ${goodResults.length} of the videos are good results:\n\t` +
          goodResults.map((x, idx) => `${idx + 1}. "${x.snippet.title}", by ${x.snippet.channelTitle}`).join(',\n\t'));

        // if found a good result (VEVO, official video, ...)
        foundVideo = goodResults[0];
      }

      debug(`Search music video: selected "${foundVideo.snippet.title}", by ${foundVideo.snippet.channelTitle}`);
      return foundVideo;
    })
    .catch(x => console.error(x));
}

function searchMusicAudio(term) {
  return searchVideo(`${term} audio`)
    .then(results => {
      debug(`Search music audio: selected "${results[0].snippet.title}", by ${results[0].snippet.channelTitle}`);
      return results[0];
    })
    .catch(x => console.error(x));
}

function isGoodMusicVideoContent(videoSearchResultItem) {
  return contains(videoSearchResultItem.snippet.channelTitle, 'VEVO') ||
    contains(videoSearchResultItem.snippet.channelTitle.toLowerCase(), 'official') ||
    contains(videoSearchResultItem.snippet.title.toLowerCase(), 'official')
}

function contains(string, content) {
  return !!(~(string || "").indexOf(content));
}

module.exports = {
  searchVideo,
  searchMusicVideo,
  searchMusicAudio
};