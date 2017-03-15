# spotivy
> Spotify music videos downloader

## Usage
```bash
node main.js <options>
```

## Arguments
- `-o`, `--output`: location where to save the downloaded files *(default: tracks)*
- `-f`, `--format`: the format of the file to download. Either `audio` or `video` *(default: video)*
- `-a`, `--audio`: flag to download as audio; equivalent to `--format=audio`

## Configuration
1.  Rename `config.example.json` to `config.json`.
1.  Put the username of whom you want to dowload playlist tracks into `spotify.username`.
1.  Create an application on [Spotify Developers website](https://developer.spotify.com/my-applications/).
    Put the Client ID and Client Secret into `spotify.clientId` and `spotify.clientSecret`, respectively.
1.  Create an [YouTube API key](https://console.developers.google.com) and put into `youtube.key`.