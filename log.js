const chalk = require('chalk');
const leftPad = require('left-pad');
const readline = require('readline');

const { INFO_COLUMN_WIDTH } = require('./constants');

const debugPrimaryColor = chalk.reset.cyan;
const debugSecondaryColor = chalk.reset.cyan.bold;
const errorPrimaryColor = chalk.reset.red;
const warnPrimaryColor = chalk.reset.yellow;
const promptPrimaryColor = chalk.reset.magenta;
const promptSecondaryColor = chalk.reset.magenta.bold;

function log(logger, level, ...args) {
  if (logger)
    logger[level].apply(logger, args);
}

function info(logger, ...args) {
  log(logger, 'info', ...args);
}

function debug(logger, ...args) {
  let colorizeSecondaryText = msg => Array.isArray(msg) ? msg.map(colorizeSecondaryText) : debugSecondaryColor(msg);
  args = args.map(colorizeSecondaryText);

  log(logger, 'debug', debugPrimaryColor(leftPad('[DEBUG]', INFO_COLUMN_WIDTH)), ...args);
}

function warn(logger, ...args) {
  log(logger, 'warn', warnPrimaryColor(leftPad('[WARN]', INFO_COLUMN_WIDTH)), ...args);
}

function error(logger, ...args) {
  log(logger, 'error', errorPrimaryColor(leftPad('[ERROR]', INFO_COLUMN_WIDTH)), ...args);
}

function prompt(text) {
  const inputInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    const question = `${promptPrimaryColor(leftPad("[PROMPT]", INFO_COLUMN_WIDTH))} ${promptSecondaryColor(text)}`;
    inputInterface.question(question, (answer) => {
      inputInterface.close();
      resolve(answer);
    });
  });
}

module.exports = { info, debug, error, warn, prompt };
