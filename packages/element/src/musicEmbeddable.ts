type MusicEmbed =
  | {
      type: "generic";
      link: string;
      intrinsicSize: { w: number; h: number };
    }
  // YouTube Music uses the existing YouTube player and timestamp handling.
  | { type: "youtube"; link: string };

const parseURL = (link: string): URL | null => {
  try {
    const url = new URL(link);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

const getSoundCloudContentURL = (url: URL): string | null => {
  const hostname = url.hostname.replace(/^www\./, "");
  if (
    hostname === "soundcloud.com" &&
    /^\/[\w-]+\/(?:sets\/)?[\w-]+\/?$/.test(url.pathname)
  ) {
    // Keep the content URL, not the widget's arbitrary query parameters.
    return `https://${hostname}${url.pathname}`;
  }
  if (hostname === "api.soundcloud.com") {
    // Copied widgets can encode the colons in the newer URN identifiers.
    const path = url.pathname.replace(/%3a/gi, ":");
    if (/^\/(tracks|playlists)\/(?:\d+|soundcloud:\1:\d+)\/?$/.test(path)) {
      return `https://${hostname}${path}`;
    }
  }
  return null;
};

/** Official music players, resolved locally without fetching provider metadata. */
export const parseMusicLink = (link: string): MusicEmbed | null => {
  const url = parseURL(link);
  if (!url) {
    return null;
  }

  const hostname = url.hostname.replace(/^www\./, "");
  const path = url.pathname;

  switch (hostname) {
    case "music.youtube.com": {
      const video = url.searchParams.get("v");
      const playlist = url.searchParams.get("list");
      let target: URL;
      if (path === "/watch" && video && /^[\w-]{11}$/.test(video)) {
        target = new URL("https://www.youtube.com/watch");
        target.searchParams.set("v", video);
      } else if (
        path === "/playlist" &&
        playlist &&
        /^[\w-]+$/.test(playlist)
      ) {
        target = new URL("https://www.youtube.com/playlist");
        target.searchParams.set("list", playlist);
      } else {
        return null;
      }
      for (const key of ["t", "start"]) {
        const value = url.searchParams.get(key);
        if (value) {
          target.searchParams.set(key, value);
        }
      }
      return { type: "youtube", link: target.href };
    }
    case "open.spotify.com": {
      const match = path.match(
        /^\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(track|album|artist|playlist|episode|show)\/([a-zA-Z0-9]{22})\/?$/,
      );
      return match
        ? {
            type: "generic",
            link: `https://open.spotify.com/embed/${match[1]}/${match[2]}`,
            intrinsicSize: { w: 400, h: 352 },
          }
        : null;
    }
    case "music.apple.com":
    case "embed.music.apple.com": {
      const match = path.match(
        /^\/([a-z]{2})\/(album|song|playlist)\/([^/]+)\/(\d+|pl\.[\w-]+)\/?$/,
      );
      if (!match || (match[2] === "playlist") !== match[4].startsWith("pl.")) {
        return null;
      }
      const target = new URL(`https://embed.music.apple.com${path}`);
      const song = url.searchParams.get("i");
      if (match[2] === "album" && song && /^\d+$/.test(song)) {
        target.searchParams.set("i", song);
      }
      return {
        type: "generic",
        link: target.href,
        intrinsicSize: {
          w: 660,
          h: match[2] === "song" || target.searchParams.has("i") ? 175 : 450,
        },
      };
    }
    case "soundcloud.com":
    case "w.soundcloud.com": {
      let content = url;
      if (hostname === "w.soundcloud.com") {
        if (path !== "/player/" && path !== "/player") {
          return null;
        }
        const nestedURL = parseURL(url.searchParams.get("url") || "");
        if (!nestedURL) {
          return null;
        }
        content = nestedURL;
      }
      const contentURL = getSoundCloudContentURL(content);
      if (!contentURL) {
        return null;
      }
      const target = new URL("https://w.soundcloud.com/player/");
      target.searchParams.set("url", contentURL);
      target.searchParams.set("auto_play", "false");
      const isPlaylist = /\/(?:sets|playlists)\//.test(content.pathname);
      return {
        type: "generic",
        link: target.href,
        intrinsicSize: { w: 500, h: isPlaylist ? 450 : 166 },
      };
    }
    case "deezer.com":
    case "widget.deezer.com": {
      const match = path.match(
        /^\/(?:[a-z]{2}\/|widget\/(?:dark|light|auto)\/)?(track|album|artist|playlist|podcast|episode)\/(\d+)\/?$/,
      );
      return match
        ? {
            type: "generic",
            link: `https://widget.deezer.com/widget/dark/${match[1]}/${match[2]}`,
            intrinsicSize: { w: 700, h: 300 },
          }
        : null;
    }
    case "tidal.com":
    case "listen.tidal.com":
    case "embed.tidal.com": {
      const match = path.match(
        /^\/(?:browse\/)?(tracks?|albums?|videos?|playlists?)\/([\w-]+)(?:\/u)?\/?$/,
      );
      if (!match) {
        return null;
      }
      const type = match[1].replace(/s$/, "");
      const id = match[2];
      if (
        !(type === "playlist"
          ? /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)
          : /^\d+$/.test(id))
      ) {
        return null;
      }
      return {
        type: "generic",
        link: `https://embed.tidal.com/${type}s/${id}`,
        intrinsicSize: { w: 600, h: type === "track" ? 150 : 450 },
      };
    }
    default:
      return null;
  }
};
