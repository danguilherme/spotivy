const Youtube = require('youtube-api');

const { debug } = require('./log');

function login(key) {
  return new Promise((resolve, reject) => {
    const result = Youtube.authenticate({
      type: 'key',
      key
    });
    resolve(result);
  });
}

function searchVideo(term, { logger } = {}) {
  return new Promise(function (resolve, reject) {
    debug(logger, `Search video: search "${term}"`);

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

      debug(logger, `Search video: ${results.items.length} item(s) returned`);
      resolve(results.items);
    });
  });
}

function searchMusicVideo(term, { logger } = {}) {
  return searchVideo(term, { logger })
    .then(results => {
      let foundVideo = results[0];
      let goodResults = results
        .slice(0, 5) // in the first 5 results...
        .filter(isGoodMusicVideoContent);

      if (!goodResults.length) {
        debug(logger, `Search music video: None of the videos is considered a good result`);
      } else {
        debug(
          logger,
          `Search music video:`,
          [
            `${goodResults.length} of the videos are good results:`,
            ...goodResults.map((x, idx) => `${idx + 1}. "${x.snippet.title}", by ${x.snippet.channelTitle}`)
          ]
        );

        // if found a good result (VEVO, official video, ...)
        foundVideo = goodResults[0];
      }

      debug(logger, `Search music video: selected "${foundVideo.snippet.title}", by ${foundVideo.snippet.channelTitle}`);
      return foundVideo;
    })
    .catch(x => console.error(x));
}

function searchMusicAudio(term, { logger } = {}) {
  return searchVideo(`${term} audio`, { logger })
    .then(results => {
      if (results[0])
        debug(logger, `Search music audio: selected "${results[0].snippet.title}", by ${results[0].snippet.channelTitle}`);
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
  login,
  searchVideo,
  searchMusicVideo,
  searchMusicAudio
};