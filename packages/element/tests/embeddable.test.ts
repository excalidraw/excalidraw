import {
  embeddableURLValidator,
  getEmbedLink,
  maybeParseEmbedSrc,
} from "../src/embeddable";

describe("Reddit embedding", () => {
  const postUrl =
    "https://www.reddit.com/r/Showerthoughts/comments/2safxv/we_should_start_keeping_giraffes_a_secret_from/";
  const canonicalComment =
    "https://www.reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic/";
  const legacyComment =
    "https://www.reddit.com/r/Showerthoughts/comments/2safxv/we_should_start_keeping_giraffes_a_secret_from/cno7zic/";

  it.each([
    [
      postUrl,
      "https://reddit.com/r/Showerthoughts/comments/2safxv/we_should_start_keeping_giraffes_a_secret_from",
    ],
    [
      "https://reddit.com/r/Showerthoughts/comments/2safxv/a-title-with-hyphens/",
      "https://reddit.com/r/Showerthoughts/comments/2safxv/a-title-with-hyphens",
    ],
    [
      canonicalComment,
      "https://reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic",
    ],
    [
      legacyComment,
      "https://reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic",
    ],
    [
      "http://reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic?context=3#context",
      "https://reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic",
    ],
    [
      "reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic",
      "https://reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic",
    ],
    [
      "https://reddit.com/r/Showerthoughts/comments/2safxv/a-title-with-hyphens/cno7zic/",
      "https://reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic",
    ],
  ])("renders a validated Reddit link for %s", (url, expectedHref) => {
    const result = getEmbedLink(url);
    expect(result?.type).toBe("document");
    if (result?.type === "document") {
      const html = result.srcdoc("light");
      expect(html).toContain(`<a href="${expectedHref}"></a>`);
      expect(html.match(/<script\b/g)).toHaveLength(1);
      expect(html).toContain('src="https://embed.reddit.com/widgets.js"');
    }
  });

  it("embeds the comment extracted from Reddit blockquote markup", () => {
    const markup = `<blockquote class="reddit-embed-bq"><a href="${canonicalComment}">Comment</a></blockquote>`;
    const result = getEmbedLink(maybeParseEmbedSrc(markup));
    expect(result?.type).toBe("document");
    if (result?.type === "document") {
      expect(result.srcdoc("light")).toContain("/comment/cno7zic");
    }
  });

  it.each([
    "https://reddit.com.evil.example/r/a/comments/b/comment/c",
    "https://reddit.com@evil.example/r/a/comments/b/comment/c",
    "https://reddit.com/r/a/comments/b/comment/c/extra",
    "https://reddit.com/r/a/comments/b/comment/c%22",
  ])("does not create Reddit srcdoc for an invalid URL: %s", (url) => {
    expect(getEmbedLink(url)?.type).not.toBe("document");
  });

  it("does not copy untrusted query or fragment text into srcdoc", () => {
    const result = getEmbedLink(
      `${canonicalComment}?x=%22%3E%3Cscript%3E#untrusted`,
    );
    expect(result?.type).toBe("document");
    if (result?.type === "document") {
      const html = result.srcdoc("light");
      expect(html).toContain(
        '<a href="https://reddit.com/r/Showerthoughts/comments/2safxv/comment/cno7zic"></a>',
      );
      expect(html.match(/<script\b/g)).toHaveLength(1);
      expect(html).not.toContain("untrusted");
    }
  });
});

describe("YouTube timestamp parsing", () => {
  it("should parse YouTube URLs with timestamp in seconds", () => {
    const testCases = [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90",
        expectedStart: 90,
      },
      {
        url: "https://youtu.be/dQw4w9WgXcQ?t=120",
        expectedStart: 120,
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=150",
        expectedStart: 150,
      },
    ];

    testCases.forEach(({ url, expectedStart }) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        expect(result.link).toContain(`start=${expectedStart}`);
      }
    });
  });

  it("should parse YouTube URLs with timestamp in time format", () => {
    const testCases = [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s",
        expectedStart: 90, // 1*60 + 30
      },
      {
        url: "https://youtu.be/dQw4w9WgXcQ?t=2m45s",
        expectedStart: 165, // 2*60 + 45
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s",
        expectedStart: 3723, // 1*3600 + 2*60 + 3
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s",
        expectedStart: 45,
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5m",
        expectedStart: 300, // 5*60
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=2h",
        expectedStart: 7200, // 2*3600
      },
    ];

    testCases.forEach(({ url, expectedStart }) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        expect(result.link).toContain(`start=${expectedStart}`);
      }
    });
  });

  it("should handle YouTube URLs without timestamps", () => {
    const testCases = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ];

    testCases.forEach((url) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        expect(result.link).not.toContain("start=");
      }
    });
  });

  it("should handle YouTube shorts URLs with timestamps", () => {
    const url = "https://www.youtube.com/shorts/dQw4w9WgXcQ?t=30";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toContain("start=30");
    }
    // Shorts should have portrait aspect ratio
    expect(result?.intrinsicSize).toEqual({ w: 315, h: 560 });
  });

  it("should handle YouTube live URLs", () => {
    const url = "https://www.youtube.com/live/dQw4w9WgXcQ?si=abc&t=30";
    const result = getEmbedLink(url);

    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(
        "https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1&start=30",
      );
    }
  });

  it("should handle playlist URLs with timestamps", () => {
    const url =
      "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy1KbG5lbfgQ0-PKQY6FKYZ&t=60";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toContain("start=60");
      expect(result.link).toContain("list=PLrAXtmRdnEQy1KbG5lbfgQ0-PKQY6FKYZ");
    }
  });

  it("should handle malformed or edge case timestamps", () => {
    const testCases = [
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=abc",
        expectedStart: 0, // Invalid timestamp should default to 0
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=",
        expectedStart: 0, // Empty timestamp should default to 0
      },
      {
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0",
        expectedStart: 0, // Zero timestamp should be handled
      },
    ];

    testCases.forEach(({ url, expectedStart }) => {
      const result = getEmbedLink(url);
      expect(result).toBeTruthy();
      expect(result?.type).toBe("video");
      if (result?.type === "video" || result?.type === "generic") {
        if (expectedStart === 0) {
          expect(result.link).not.toContain("start=");
        } else {
          expect(result.link).toContain(`start=${expectedStart}`);
        }
      }
    });
  });

  it("should preserve other URL parameters", () => {
    const url =
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90&feature=youtu.be&list=PLtest";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toContain("start=90");
      expect(result.link).toContain("enablejsapi=1");
    }
  });
});

describe("Google Drive video embedding", () => {
  it.each([
    {
      url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?usp=sharing",
      expectedLink:
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview",
    },
    {
      url: "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      expectedLink:
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview",
    },
    {
      url: "https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz123456",
      expectedLink:
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview",
    },
  ])("should normalize Google Drive link: $url", ({ url, expectedLink }) => {
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(expectedLink);
    }
    expect(result?.intrinsicSize).toEqual({ w: 560, h: 315 });
  });

  it("should preserve resourcekey when available", () => {
    const url =
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?resourcekey=0-abcdef123456";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview?resourcekey=0-abcdef123456",
      );
    }
  });

  it("should preserve timestamp when available", () => {
    const url =
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?t=9";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview?t=9",
      );
    }
  });

  it("should preserve resourcekey and timestamp together", () => {
    const url =
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view?resourcekey=0-abcdef123456&t=9";
    const result = getEmbedLink(url);

    expect(result).toBeTruthy();
    expect(result?.type).toBe("video");
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/preview?resourcekey=0-abcdef123456&t=9",
      );
    }
  });

  it("should validate Google Drive domain by default", () => {
    expect(
      embeddableURLValidator(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz123456/view",
        undefined,
      ),
    ).toBe(true);
  });
});

describe("Instagram embedding", () => {
  it.each([
    {
      url: "https://www.instagram.com/p/BsOGulcndj-/",
      expectedLink: "https://www.instagram.com/p/BsOGulcndj-/embed/",
    },
    {
      url: "https://instagram.com/reel/DSu-vbYDDlf/?igsh=MWQ1ZGUxMzBkMA==",
      expectedLink: "https://www.instagram.com/reel/DSu-vbYDDlf/embed/",
    },
    {
      url: "https://www.instagram.com/reels/DSu-vbYDDlf/",
      expectedLink: "https://www.instagram.com/reel/DSu-vbYDDlf/embed/",
    },
    {
      url: "https://www.instagram.com/world_record_egg/p/BsOGulcndj-/",
      expectedLink: "https://www.instagram.com/p/BsOGulcndj-/embed/",
    },
  ])("should normalize Instagram link: $url", ({ url, expectedLink }) => {
    expect(embeddableURLValidator(url, undefined)).toBe(true);
    const result = getEmbedLink(url);
    expect(result?.type).toBe("generic");
    if (result?.type === "generic") {
      expect(result.link).toBe(expectedLink);
    }
  });
});
