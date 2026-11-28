import {
  embeddableURLValidator,
  getEmbedLink,
  maybeParseEmbedSrc,
} from "../src/embeddable";

const spotifyId = "4uLU6hMCjMI75M1A2tKUQC";

describe("music embeds", () => {
  it.each([
    ...["track", "album", "artist", "playlist", "episode", "show"].map(
      (type) => ({
        url: `https://open.spotify.com/${type}/${spotifyId}?si=share`,
        expected: `https://open.spotify.com/embed/${type}/${spotifyId}`,
        size: { w: 400, h: 352 },
      }),
    ),
    {
      url: `https://open.spotify.com/intl-pt/track/${spotifyId}`,
      expected: `https://open.spotify.com/embed/track/${spotifyId}`,
      size: { w: 400, h: 352 },
    },
    {
      url: `https://open.spotify.com/embed/track/${spotifyId}?utm_source=generator`,
      expected: `https://open.spotify.com/embed/track/${spotifyId}`,
      size: { w: 400, h: 352 },
    },
    {
      url: "https://music.apple.com/us/album/abbey-road/1441164426?i=1441164589&app=music",
      expected:
        "https://embed.music.apple.com/us/album/abbey-road/1441164426?i=1441164589",
      size: { w: 660, h: 175 },
    },
    {
      url: "https://music.apple.com/br/song/something/1441164589",
      expected: "https://embed.music.apple.com/br/song/something/1441164589",
      size: { w: 660, h: 175 },
    },
    {
      url: "https://music.apple.com/us/album/abbey-road/1441164426",
      expected: "https://embed.music.apple.com/us/album/abbey-road/1441164426",
      size: { w: 660, h: 450 },
    },
    {
      url: "https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb?app=music",
      expected:
        "https://embed.music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb",
      size: { w: 660, h: 450 },
    },
    {
      url: "https://soundcloud.com/artist/track?utm_source=clipboard",
      expected:
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack&auto_play=false",
      size: { w: 500, h: 166 },
    },
    {
      url: "https://www.soundcloud.com/artist/sets/playlist",
      expected:
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Fsets%2Fplaylist&auto_play=false",
      size: { w: 500, h: 450 },
    },
    {
      url: "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/293&auto_play=true&visual=true",
      expected:
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F293&auto_play=false",
      size: { w: 500, h: 166 },
    },
    {
      url: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F123",
      expected:
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2F123&auto_play=false",
      size: { w: 500, h: 450 },
    },
    {
      // The current widget redirects public track links to this URN form.
      url: "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A293&auto_play=false",
      expected:
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2Fsoundcloud%3Atracks%3A293&auto_play=false",
      size: { w: 500, h: 166 },
    },
    {
      url: "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2Fsoundcloud%3Aplaylists%3A123",
      expected:
        "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Fplaylists%2Fsoundcloud%3Aplaylists%3A123&auto_play=false",
      size: { w: 500, h: 450 },
    },
    ...["track", "album", "artist", "playlist", "podcast", "episode"].map(
      (type) => ({
        url: `https://www.deezer.com/br/${type}/3135556?utm_source=share`,
        expected: `https://widget.deezer.com/widget/dark/${type}/3135556`,
        size: { w: 700, h: 300 },
      }),
    ),
    {
      url: "https://widget.deezer.com/widget/light/playlist/1479458365",
      expected: "https://widget.deezer.com/widget/dark/playlist/1479458365",
      size: { w: 700, h: 300 },
    },
    {
      url: "https://tidal.com/browse/track/74695970",
      expected: "https://embed.tidal.com/tracks/74695970",
      size: { w: 600, h: 150 },
    },
    {
      url: "https://tidal.com/album/38094797/u?share=1",
      expected: "https://embed.tidal.com/albums/38094797",
      size: { w: 600, h: 450 },
    },
    {
      url: "https://listen.tidal.com/playlist/01234567-89ab-cdef-0123-456789abcdef",
      expected:
        "https://embed.tidal.com/playlists/01234567-89ab-cdef-0123-456789abcdef",
      size: { w: 600, h: 450 },
    },
    {
      url: "https://embed.tidal.com/videos/34163737",
      expected: "https://embed.tidal.com/videos/34163737",
      size: { w: 600, h: 450 },
    },
  ])("normalizes $url", ({ url, expected, size }) => {
    expect(embeddableURLValidator(url, undefined)).toBe(true);
    expect(getEmbedLink(url)).toEqual({
      type: "generic",
      link: expected,
      intrinsicSize: size,
      sandbox: { allowSameOrigin: true },
    });
    // Provider conversions must also work on saved embed URLs.
    expect(embeddableURLValidator(expected, undefined)).toBe(true);
    expect(getEmbedLink(expected)).toEqual(getEmbedLink(url));
  });

  it.each([
    [
      "https://music.youtube.com/watch?si=share&v=dQw4w9WgXcQ&t=1m30s",
      "https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1&start=90",
    ],
    [
      "https://music.youtube.com/playlist?list=PLtest&si=share&start=30",
      "https://www.youtube.com/embed/videoseries?list=PLtest&enablejsapi=1&start=30",
    ],
  ])("uses the YouTube player for %s", (url, expected) => {
    expect(embeddableURLValidator(url, undefined)).toBe(true);
    expect(getEmbedLink(url)).toEqual({
      type: "video",
      link: expected,
      intrinsicSize: { w: 560, h: 315 },
      sandbox: { allowSameOrigin: true },
    });
  });

  it.each([
    `https://open.spotify.com.evil.test/track/${spotifyId}`,
    `https://evil.test/open.spotify.com/track/${spotifyId}`,
    `https://open.spotify.com@evil.test/track/${spotifyId}`,
    `https://user:password@open.spotify.com/track/${spotifyId}`,
    `https://open.spotify.com:8443/track/${spotifyId}`,
    `ftp://open.spotify.com/track/${spotifyId}`,
    `javascript:https://open.spotify.com/track/${spotifyId}`,
    `https://open.spotify.com/track/${spotifyId}/extra`,
    "https://open.spotify.com/user/someone",
    "https://open.spotify.com/track/not-an-id",
    "https://music.apple.com/us/playlist/name/123",
    "https://music.apple.com/us/album/name/pl.invalid",
    "https://embed.music.apple.com.evil.test/us/song/name/123",
    "https://soundcloud.com/artist",
    "https://w.soundcloud.com/player/?url=https://evil.test/tracks/123",
    "https://w.soundcloud.com/player/?url=https://api.soundcloud.com.evil.test/tracks/123",
    "https://w.soundcloud.com/player/?url=https://user@api.soundcloud.com/tracks/123",
    "https://w.soundcloud.com/player/?url=javascript:alert(1)",
    "https://w.soundcloud.com/player/?url=not-a-url",
    "https://w.soundcloud.com/player/?url=https://api.soundcloud.com/tracks/soundcloud%3Aplaylists%3A293",
    "https://w.soundcloud.com/player/?url=https://api.soundcloud.com/tracks/soundcloud%3Atracks%3A293%2Fextra",
    "https://w.soundcloud.com/other?url=https://soundcloud.com/artist/track",
    "https://deezer.com/track/not-an-id",
    "https://widget.deezer.com.evil.test/widget/dark/track/123",
    "https://tidal.com/playlist/not-a-uuid",
    "https://tidal.com/track/not-a-number",
    "https://embed.tidal.com.evil.test/tracks/123",
    "https://music.youtube.com/watch?v=invalid",
    "https://music.youtube.com/watch?list=PLtest",
    "https://music.youtube.com/channel/UCtest",
    "not a url",
  ])("does not allow unsupported or misleading music URLs: %s", (url) => {
    expect(embeddableURLValidator(url, undefined)).toBe(false);
  });

  it("does not forward unrelated query parameters or fragments to a player", () => {
    const url = `https://open.spotify.com/track/${spotifyId}?redirect=https://evil.test&autoplay=1#fragment`;
    expect(getEmbedLink(url)).toMatchObject({
      link: `https://open.spotify.com/embed/track/${spotifyId}`,
    });
  });

  it("honors host validation overrides for music links", () => {
    const url = `https://open.spotify.com/track/${spotifyId}`;
    expect(embeddableURLValidator(url, false)).toBe(false);
    expect(embeddableURLValidator(url, () => false)).toBe(false);
    expect(embeddableURLValidator(url, ["example.com"])).toBe(false);
    expect(embeddableURLValidator(url, () => undefined)).toBe(true);
    expect(embeddableURLValidator(url, ["open.spotify.com"])).toBe(true);
  });

  it("reuses cached descriptors", () => {
    const url = `https://open.spotify.com/track/${spotifyId}`;
    expect(getEmbedLink(url)).toBe(getEmbedLink(url));
  });

  it("supports copied iframe code through the existing extractor", () => {
    const url = `https://open.spotify.com/embed/track/${spotifyId}`;
    const src = maybeParseEmbedSrc(
      `<iframe src="${url}" width="100%" height="352" allow="encrypted-media"></iframe>`,
    );
    expect(src).toBe(url);
    expect(embeddableURLValidator(src, undefined)).toBe(true);
  });
});
