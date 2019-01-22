export interface Config {
  spotifyClientId: string;
  spotifyClientSecret: string;
  youtubeKey: string;

  audio: boolean;
  format: 'audio' | 'video';
  output: string;
  quality: `144p` | `240p` | `360p` | `720p` | `highest` | `lowest`;
  verbose: boolean;
  flat: boolean;
}

export interface ConfigFile {
  spotify: {
    clientId: Config['spotifyClientId'];
    clientSecret: Config['spotifyClientSecret'];
  };
  youtube: {
    key: Config['youtubeKey'];
  };
}

export interface MetadataFile {
  ids: string[];
  names: { [id: string]: string };
}
