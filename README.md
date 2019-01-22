# Spotivy
> Spotify music videos downloader

![Application preview](docs/screenshot.png)

Download all tracks from your Spotify playlists as videos or MP3.

## How it Works
Spotivy gets the track information from Spotify and then search YouTube in the format of `${artist_name} - ${track_name}`.

To decide which video to download from the returned list, it applies a [very simple test](https://github.com/danguilherme/spotivy/blob/v0.4.3/youtube_search.js#L76-L80) for each item:

- video was published by any `VEVO` affiliated channel?
- video channel contains `official` in its name?
- video contains `official` in its title?

If any of these assertions is true for the video being tested, this is the media that will be downloaded.

It's not precise, but it does the job 90% of the time. [Any suggestion is welcome!](https://github.com/danguilherme/spotivy/issues/8)

## Configuration
1.  Install the CLI
    ```bash
    npm install -g spotivy
    ```
1.  Follow the instructions in the `init` command:
    ```bash
    spotivy init
    ```
    Basically, you'll need to create the keys to use Spotify and YouTube APIs, and configure the tool with them:
    1.  Create an [YouTube API key](https://console.developers.google.com) and put in the specified prompt.
    1.  Create an application on [Spotify Developers website](https://developer.spotify.com/my-applications/), get the **Client ID** and **Client Secret** values, and do the same when requested by the tool.

    * **Note:** You can also pass the credentials in each command call:
    ```bash
    spotivy playlist danguilherme --spotify-client-id=clientid --spotify-client-secret=clientsecret --youtube-key=ytkey
    ```

## Usage
```bash
spotivy help
```

### Commands
- [Tool configuration](#init)
- [Download user playlists](#download-playlists)
- [Download single tracks](#download-single-tracks)

### Global Options
These options are accepted by **any command**.

| Option | Description | Default |
| ------ | ------ | ------ |
| `-o`, `--output` | location where to save the downloaded media | `./media` |
| `-f`, `--format` | the format of the file to download. Either `video` or `audio` | `video` |
| `-q`, `--quality` | the [quality](https://en.wikipedia.org/w/index.php?title=YouTube&oldid=800910021#Quality_and_formats) in which the video should be downloaded (ignored if `--format=audio`). Options: `144p`, `240p`, `360p`, `720p`, `highest`, `lowest` | `highest` |
| `--flat` | indicates if the files must be saved in one single folder (no subfolders) | - |
| `-a`, `--audio` | flag to download as audio; equivalent to `--format=audio` | - |
| `-v`, `--verbose` | show detailed logs | - |

### Init
Configure the tool with the keys from Spotify and YouTube.

```bash
spotivy init

spotivy help init
```

### Download playlists
Download any public playlists from a given user.

Accepts all [global options](#global-options).

```bash
spotivy playlist <username> [playlist_ids...] # user id and playlist id, zero or more
spotivy playlist danguilherme # download all public playlists from the user
spotivy playlist danguilherme 34X8sCTs81AWXD8hhbTZVn
spotivy playlist danguilherme 3BG5tkH8g77ClLThZiosGD 3Zpkeg6VE5wj5eghBxv0R6 -a # 2 playlists, audio only

spotivy help playlist
```

### Download single tracks
Download any track you want by its Spotify ID.

Accepts all [global options](#global-options).

```bash
spotivy track <track...> # tracks list
spotivy track 5tXyNhNcsnn7HbcABntOSf
spotivy track 0SFJQqnU0k42NYaLb3qqTx 31acMiV67UgKn1ScFChFxo 52K4Nl7eVNqUpUeJeWJlwT 5tXyNhNcsnn7HbcABntOSf -a # 4 tracks, audio only

spotivy help track
```

# License
Spotivy is under [MIT License](LICENSE).
