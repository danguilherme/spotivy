const { cmd_track } = require('./track');
const { cmd_playlist, cmd_user } = require('./playlist');

module.exports = {
  init: require('./init'),
  track: cmd_track,
  playlist: cmd_playlist,
  userPlaylists: cmd_user,
};
