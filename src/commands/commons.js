const leftPad = require('left-pad');
const chalk = require('chalk');

const { INFO_COLUMN_WIDTH, info, debug } = require('../log');

module.exports = { logDownloadError };

function logDownloadError(err, logger) {
  info(
    logger,
    chalk.bold.red(leftPad('[Download failed]', INFO_COLUMN_WIDTH)),
    err.message || err
  );
  debug(logger, err.stack);

  const extraInfo = JSON.stringify(err, null, 2);
  if (extraInfo !== '{}') {
    debug(logger, 'Extra info:\n' + JSON.stringify(err, null, 2));
  }
}
