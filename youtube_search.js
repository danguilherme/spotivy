const config = require('./config.json');
const Youtube = require('youtube-api');

Youtube.authenticate({
  type: 'key',
  key: config.youtube.key
});



function searchVideo(term) {
  return new Promise(function (resolve, reject) {
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

      resolve(results.items);
    });
  });
}

function searchMusicVideo(term) {
  return searchVideo(term)
    .then(results => {
      let videos = results.filter(x => ~x.snippet.channelTitle.indexOf('VEVO'));
      if (videos.length)
        // if found from VEVO, return it
        return videos[0];
      else
        // if not, return the first match
        return results[0];
    });
}

// searchMusicVideo(process.argv[2]).then(x => console.log(x.map(i => i.id.kind)));

module.exports = {
  searchVideo,
  searchMusicVideo
};