const fs = require('fs');
const fsPath = require('path');
const mkdirp = require('mkdirp');

module.exports = {
  isTrackDownloaded,
  updateMetadata,
  loadMetadata,
  saveMetadata,
};

const FILENAME = '.downloaded';

function loadMetadata(baseFolderPath) {
  const filePath = fsPath.join(baseFolderPath, FILENAME);

  if (!fs.existsSync(filePath))
    saveMetadata(
      {
        ids: [],
        names: {},
      },
      baseFolderPath
    );

  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveMetadata(metadata, baseFolderPath) {
  const filePath = fsPath.join(baseFolderPath, FILENAME);

  if (!fs.existsSync(filePath)) {
    mkdirp.sync(fsPath.dirname(filePath));
  }
  fs.writeFileSync(filePath, JSON.stringify(metadata, null, 4));
}

function isTrackDownloaded(trackId, metadata) {
  return metadata.ids.indexOf(trackId) !== -1;
}

function updateMetadata(track, metadata) {
  let fileName = `${track.artists[0].name} - ${track.name}`;

  // update downloaded tracks control
  metadata.ids.push(track.id);
  // info for humans to understand the metadata file
  metadata.names[track.id] = fileName;

  return metadata;
}
