const chalk = require('chalk');

module.exports = function log() {
  if (process.env.spotivyDebug)
    console.log.apply(this, [chalk.reset.yellow('[DEBUG]'), chalk.reset.gray(...arguments)]);
}