const chalk = require('chalk');
const leftPad = require('left-pad');

const { INFO_COLUMN_WIDTH } = require('./constants');

let debugPrimaryColor = chalk.reset.cyan;
let debugSecondaryColor = chalk.reset.cyan.bold;

function log(logger, level, ...args) {
  if (logger)
    logger[level].apply(logger, args);
}

function info(logger, ...args) {
  logger.info.apply(logger, args);
}

function debug(logger, ...args) {
  let colorizeSecondaryText = msg => Array.isArray(msg) ? msg.map(colorizeSecondaryText) : debugSecondaryColor(msg);
  args = args.map(colorizeSecondaryText);

  log(logger, 'debug', debugPrimaryColor(leftPad('[DEBUG]', INFO_COLUMN_WIDTH)), ...args);
}

module.exports = { info, debug };