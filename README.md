# Spotivy
> Spotify music videos downloader

Download all tracks from your Spotify playlists as videos or MP3.

## Configuration
1.  Install the CLI
    ```bash
    node install -g spotivy
    ```
1.  Copy [`config.example.json`](https://github.com/danguilherme/spotivy/blob/v0.4.0/config.example.json) in the root directory as `config.json`.
    1.  Create an application on [Spotify Developers website](https://developer.spotify.com/my-applications/).
        Put the Client ID and Client Secret into `spotify.clientId` and `spotify.clientSecret`, respectively.
    1.  Create an [YouTube API key](https://console.developers.google.com) and put into `youtube.key`.
    
    * **Note:** You can also pass the credentials as command arguments:
    ```bash
    spotivy user danguilherme --spotify-client-id=clientid --spotify-client-secret=clientsecret --youtube-key=ytkey
    ```

## Usage
```bash
spotivy --help
```

### Download user playlists
Accepts all [global arguments](#global-arguments).

```bash
spotivy user danguilherme
```

**More info:**
```bash
spotivy help user
```

## Global Arguments
- `-o`, `--output`: location where to save the downloaded media *(default: `media`)*
- `-f`, `--format`: the format of the file to download. Either `audio` or `video` *(default: `video`)*
- `-a`, `--audio`: flag to download as audio; equivalent to `--format=audio`
- `-v`, `--verbose`: show detailed logs