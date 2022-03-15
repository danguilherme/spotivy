const highland = require('highland');

module.exports = { throughStream };

function throughStream() {
  return highland((push, next) => push(null, highland.nil));
}
