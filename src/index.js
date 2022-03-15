#!/usr/bin/env node

const caporal = require('caporal');
const fsPath = require('path');
const chalk = require('chalk');

const pkg = require('../package.json');
const { info, debug } = require('./log');

// commands
const {
  init: cmd_init,
  track: cmd_track,
  playlist: cmd_playlist,
  userPlaylists: cmd_user,
} = require('./commands');

const cwd = process.cwd();
const defaultOutputPath = fsPath.join(cwd, 'media');
const configPath = fsPath.join(cwd, 'config.json');

// https://en.wikipedia.org/w/index.php?title=YouTube&oldid=800910021#Quality_and_formats
const qualityMap = {
  '144p': 17,
  '240p': 36,
  '360p': 18,
  '720p': 22,
  highest: 'highest',
  lowest: 'lowest',
};

function init() {
  caporal.name('spotivy').version(pkg.version).help(pkg.description);

  // command: set up the config file
  var commandInit = caporal
    .command('init', 'Tool introduction and configuration')
    .help(
      'Configure the tool with the keys from Spotify and YouTube. Creates the config file in the current folder.'
    )
    .action((args, options, logger) => {
      beforeCommand(logger);

      cmd_init(configPath, { logger }).then(() => afterCommand(logger));
    });

  // command: download user playlist(s)
  var commandPlaylist = caporal
    .command('playlist', 'Download public playlists from the given user')
    .help('Download public playlists from the given user')
    .argument('<username>', 'The id of the playlist owner')
    .argument(
      '[playlists...]',
      'Playlist IDs. If none, all user playlists will be downloaded'
    )
    .action((args, options, logger) => {
      beforeCommand(logger);

      const config = loadConfig(configPath, Object.assign({}, options, args), {
        logger,
      });
      let cmdPromise;

      info(logger, `Saving media to '${config.output}'\n`);

      if (!args.playlists.length) {
        cmdPromise = cmd_user(args.username, {
          spotifyClientId: config.spotifyClientId,
          spotifyClientSecret: config.spotifyClientSecret,
          youtubeKey: config.youtubeKey,
          format: config.format,
          quality: qualityMap[config.quality],
          output: config.output,
          flat: config.flat,
          logger,
        });
      } else {
        cmdPromise = cmd_playlist(args.playlists, {
          spotifyClientId: config.spotifyClientId,
          spotifyClientSecret: config.spotifyClientSecret,
          youtubeKey: config.youtubeKey,
          format: config.format,
          quality: qualityMap[config.quality],
          output: config.output,
          flat: config.flat,
          logger,
        });
      }

      cmdPromise.then(() => afterCommand(logger));
    });

  // command: download track
  let commandTrack = caporal
    .command('track', 'Download single tracks')
    .help('Download single tracks')
    .argument('<tracks...>', 'Track IDs (may be more than one)')
    .action((args, options, logger) => {
      beforeCommand(logger);
      const config = loadConfig(configPath, Object.assign({}, options, args), {
        logger,
      });

      info(logger, `Saving media to '${config.output}'\n`);

      cmd_track(args.tracks, {
        spotifyClientId: config.spotifyClientId,
        spotifyClientSecret: config.spotifyClientSecret,
        youtubeKey: config.youtubeKey,
        format: config.format,
        quality: qualityMap[config.quality],
        output: config.output,
        flat: config.flat,
        logger,
      }).then(() => afterCommand(logger));
    });

  configureGlobalOptions(commandPlaylist);
  configureGlobalOptions(commandTrack);

  caporal.parse(process.argv);
}

function configureGlobalOptions(caporalCommand) {
  return caporalCommand
    .option(
      '-o, --output <output>',
      'Location where to save the downloaded media',
      /\w*/,
      defaultOutputPath
    )
    .option(
      '-f, --format <format>',
      "The format of the file to download. Either 'video' or 'audio'",
      ['audio', 'video'],
      'video'
    )
    .option(
      '-q, --quality <quality>',
      `The quality of the video to download (desconsidered if format=audio).\nOptions: ${Object.keys(
        qualityMap
      ).join(', ')}`,
      Object.keys(qualityMap),
      'highest'
    )
    .option(
      '--flat',
      'Flag to indicate if the files must be saved directly in the output folder, without subfolders',
      caporal.BOOLEAN,
      false
    )
    .option(
      '-a, --audio',
      'Download tracks as audio. Same as --format audio',
      caporal.BOOLEAN,
      false
    )
    .option(
      '--spotify-client-id [client-id]',
      'Spotify app client ID (from https://developer.spotify.com/my-applications/)'
    )
    .option(
      '--spotify-client-secret [client-secret]',
      'Spotify app client secret (from https://developer.spotify.com/my-applications/)'
    )
    .option(
      '--youtube-key [key]',
      'Youtube API key (from https://console.developers.google.com)'
    );
}

function beforeCommand(logger) {
  info(logger, chalk.bold.green(`[${pkg.name} v${pkg.version}]`));
}

function afterCommand(logger) {
  info(logger);
  info(
    logger,
    chalk.bold.green(`[${pkg.name} v${pkg.version}]`),
    'Finished successfuly'
  );
}

init();

function loadConfig(configFilePath, parsedArgs, { logger } = {}) {
  const config = {};
  try {
    const configFile = require(configFilePath);
    config.spotifyClientId = configFile.spotify.clientId;
    config.spotifyClientSecret = configFile.spotify.clientSecret;
    config.youtubeKey = configFile.youtube.key;
  } catch (e) {}

  // parsed args have preference
  parsedArgs = JSON.parse(JSON.stringify(parsedArgs)); // remove undefined keys
  Object.assign(config, parsedArgs);

  if (config.audio) config.format = 'audio';

  debug(logger, `Loaded options:\n`, JSON.stringify(config, null, 2));

  return config;
}
