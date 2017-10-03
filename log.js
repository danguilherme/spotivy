const chalk = require('chalk');
const leftPad = require('left-pad');

const { INFO_COLUMN_WIDTH } = require('./constants');

let debugPrimaryColor = chalk.reset.cyan;
let debugSecondaryColor = chalk.reset.cyan.bold;
let warnPrimaryColor = chalk.reset.yellow;

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
  log(logger, 'warn', warnPrimaryColor(leftPad('[Warn]', INFO_COLUMN_WIDTH)), ...args);
}

module.exports = { info, debug, warn };