var fs = require('fs');
const chalk = require('chalk');
const readline = require('readline');
const leftPad = require('left-pad');

const { INFO_COLUMN_WIDTH } = require('../constants');
const { info, debug, warn } = require('../log');

const promptChalk = chalk.green;

function cmd_init(configFilePath, { logger } = {}) {
  debug(logger, `Will save config file to ${configFilePath}`);

  const inputInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const config = {
    "youtube": {
      "key": ""
    },
    "spotify": {
      "clientId": "",
      "clientSecret": ""
    }
  };
  return readYoutubeKey(inputInterface)
    .then(ytKey => config.youtube.key = ytKey)
    .then(() => readSpotifyKeys(inputInterface))
    .then(sptfKeys => config.spotify = sptfKeys)
    .then(() => {
      inputInterface.close();
      debug(logger, `Config generated:\n${JSON.stringify(config, null, 2)}`);
      return saveConfig(configFilePath, config);
    });
}

function prompt(inputInterface, text) {
  return new Promise((resolve, reject) => {
    const question = `${chalk.magenta(leftPad("[PROMPT]", INFO_COLUMN_WIDTH))} ${chalk.bold.magenta(text)}`;
    inputInterface.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function readYoutubeKey(inputInterface) {
  return prompt(inputInterface, 'Youtube Key: ')
    .then((answer) => {
      if (!answer)
        return readYoutubeKey(inputInterface);

      return answer;
    });
}

function readSpotifyKeys(inputInterface) {
  const config = { clientId: "", clientSecret: "" };
  return readSpotifyClientId(inputInterface)
    .then(clientId => config.clientId = clientId)
    .then(() => readSpotifyClientSecret(inputInterface))
    .then(clientSecret => config.clientSecret = clientSecret)
    .then(() => config);
}

function readSpotifyClientId(inputInterface) {
  return prompt(inputInterface, 'Spotify Client Id: ')
    .then((answer) => {
      if (!answer)
        return readSpotifyClientId(inputInterface);

      return answer;
    });
}

function readSpotifyClientSecret(inputInterface) {
  return prompt(inputInterface, 'Spotify Client Secret: ')
    .then((answer) => {
      if (!answer)
        return readSpotifyClientSecret(inputInterface);

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