var fs = require('fs');
const chalk = require('chalk');

const { INFO_COLUMN_WIDTH } = require('../constants');
const { info, debug, prompt } = require('../log');

const promptChalk = chalk.green;

function cmd_init(configFilePath, { logger } = {}) {
  info(logger, `
  ${chalk.bgWhite.black('  INTRODUCTION  ')}

  ${chalk.bold.green('Spotivy')} is a command line tool to download Spotify tracks in batch.

  There are basically two commands, one to ${chalk.bold('download a specific track')} (${chalk.bold.gray('spotivy track <track_id>')})
and one to ${chalk.bold('download a whole playlist')} (${chalk.bold.gray('spotivy playlist <user_id> <playlist_id>')}).
  Before downloading any track, we need to configure the program with the keys of both ${chalk.green('Spotify')}
and ${chalk.bold.red('YouTube')} APIs.

  ${chalk.bgWhite.black('  KEYS  ')}

  - ${chalk.bold.red('YouTube:')} Generate an ${chalk.bold('API key')} on Google Developer Console:
             ${chalk.cyan.bold('https://console.developers.google.com/apis/library/youtube.googleapis.com/?id=125bab65-cfb6-4f25-9826-4dcc309bc508')}.
  - ${chalk.green('Spotify:')} Create a new application in Spotify developers portal:
             ${chalk.cyan.bold('https://beta.developer.spotify.com/dashboard/applications')}.
             They will provide both ${chalk.bold('Client ID')} and ${chalk.bold('Client Secret')}. Keep them.

  For more detailed information, type ${chalk.bold.gray('spotivy --help')} or head to https://danguilherme.github.io/blog/spotivy/ (pt-br).
  
  After retrieving the keys, paste them in their respective prompts:
`);

  debug(logger, `Will save config file to ${configFilePath}`);

  const config = {
    "youtube": {
      "key": ""
    },
    "spotify": {
      "clientId": "",
      "clientSecret": ""
    }
  };
  return readYoutubeKey()
    .then(ytKey => config.youtube.key = ytKey)
    .then(() => readSpotifyKeys())
    .then(sptfKeys => config.spotify = sptfKeys)
    .then(() => {
      debug(logger, `Config generated:\n${JSON.stringify(config, null, 2)}`);

      info(logger, `
  Config file successfully created at ${chalk.bold(configFilePath)}.

  Happy downloading!`);
      return saveConfig(configFilePath, config);
    });
}

function readYoutubeKey() {
  return prompt('Youtube Key: ')
    .then((answer) => {
      if (!answer)
        return readYoutubeKey();

      return answer;
    });
}

function readSpotifyKeys() {
  const config = { clientId: "", clientSecret: "" };
  return readSpotifyClientId()
    .then(clientId => config.clientId = clientId)
    .then(readSpotifyClientSecret)
    .then(clientSecret => config.clientSecret = clientSecret)
    .then(() => config);
}

function readSpotifyClientId() {
  return prompt('Spotify Client Id: ')
    .then((answer) => {
      if (!answer)
        return readSpotifyClientId();

      return answer;
    });
}

function readSpotifyClientSecret() {
  return prompt('Spotify Client Secret: ')
    .then((answer) => {
      if (!answer)
        return readSpotifyClientSecret();

      return answer;
    });
}

function saveConfig(path, config) {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(config, null, 2), function (err) {
      if (err) {
        return reject(err);
      }

      resolve(config);
    });
  })
}

module.exports = cmd_init;