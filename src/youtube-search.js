const Youtube = require('youtube-api');

const { debug, error } = require('./log');

function login(key, { logger } = {}) {
  debug(logger, `Youtube login`);
  return new Promise(
    (resolve, reject) => {
      const result = Youtube.authenticate({
        type: 'key',
        key,
      });
      debug(logger, `Youtube login: success`);
      resolve(result);
    },
    function (e) {
      debug(logger, `Youtube login failed: ${e.message}`);
      error(logger, `Stack trace:\n${e.stack}`);
      reject(e);
    }
  );
}

function searchVideo(term, { logger } = {}) {
  return new Promise(function (resolve, reject) {
    debug(logger, `Search video: search "${term}"`);

    Youtube.search.list(
      {
        part: 'snippet',
        maxResults: 20, // results per page
        q: term,
        type: 'video',
      },
      (error, response) => {
        if (error) {
          const quotaExceededError = error.errors.find(
            e => e.domain === 'youtube.quota' && e.reason === 'quotaExceeded'
          );
          if (quotaExceededError) {
            const newError = new Error(
              'Your YouTube API quota has exceeded. Read more here: https://developers.google.com/youtube/v3/getting-started#quota'
            );
            newError.originalError = error;
            return reject(newError);
          }

          return reject(error);
        }

        const { data } = response;

        debug(logger, `Search video: ${data.items.length} item(s) returned`);
        resolve(data.items);
      }
    );
  });
}

function searchMusicVideo(term, { logger } = {}) {
  return searchVideo(term, { logger }).then(results => {
    let foundVideo = results[0];
    let goodResults = results
      .slice(0, 5) // in the first 5 results...
      .filter(isGoodMusicVideoContent);

    if (!goodResults.length) {
      debug(
        logger,
        `Search music video: None of the videos is considered a good result`
      );
    } else {
      debug(logger, `Search music video:`, [
        `${goodResults.length} of ${results.length} videos are good results:`,
        ...goodResults.map(
          (x, idx) =>
            `${idx + 1}. "${x.snippet.title}", by ${x.snippet.channelTitle}`
        ),
      ]);

      // if found a good result (VEVO, official video, ...)
      foundVideo = goodResults[0];
      debug(
        logger,
        `Search music video: selected "${foundVideo.snippet.title}", by ${foundVideo.snippet.channelTitle}`
      );
    }

    return foundVideo;
  });
}

function searchMusicAudio(term, { logger } = {}) {
  return searchVideo(`${term} audio`, { logger }).then(results => {
    if (results[0])
      debug(
        logger,
        `Search music audio: selected "${results[0].snippet.title}", by ${results[0].snippet.channelTitle}`
      );
    return results[0];
  });
}

function isGoodMusicVideoContent(videoSearchResultItem) {
  return (
    contains(videoSearchResultItem.snippet.channelTitle, 'VEVO') ||
    contains(
      videoSearchResultItem.snippet.channelTitle.toLowerCase(),
      'official'
    ) ||
    contains(videoSearchResultItem.snippet.title.toLowerCase(), 'official')
  );
}

function contains(string, content) {
  return !!~(string || '').indexOf(content);
}

module.exports = {
  login,
  searchVideo,
  searchMusicVideo,
  searchMusicAudio,
};
