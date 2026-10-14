import { embeddableURLValidator, getEmbedLink } from "../src/embeddable";

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

describe("Vimeo video embedding", () => {
  it.each([
    {
      url: "https://vimeo.com/76979871",
      expectedLink: "https://player.vimeo.com/video/76979871?api=1",
    },
    {
      url: "https://player.vimeo.com/video/76979871",
      expectedLink: "https://player.vimeo.com/video/76979871?api=1",
    },
    {
      url: "https://player.vimeo.com/video/76979871?badge=0&autopause=0",
      expectedLink: "https://player.vimeo.com/video/76979871?api=1",
    },
    // unlisted videos only play with their privacy hash
    {
      url: "https://vimeo.com/123456789/abcdef1234",
      expectedLink:
        "https://player.vimeo.com/video/123456789?h=abcdef1234&api=1",
    },
    {
      url: "https://vimeo.com/123456789/abcdef1234?share=copy",
      expectedLink:
        "https://player.vimeo.com/video/123456789?h=abcdef1234&api=1",
    },
    {
      url: "https://player.vimeo.com/video/123456789?h=abcdef1234&badge=0",
      expectedLink:
        "https://player.vimeo.com/video/123456789?h=abcdef1234&api=1",
    },
    {
      url: "https://player.vimeo.com/video/123456789?badge=0&h=abcdef1234",
      expectedLink:
        "https://player.vimeo.com/video/123456789?h=abcdef1234&api=1",
    },
  ])("should normalize Vimeo link: $url", ({ url, expectedLink }) => {
    const result = getEmbedLink(url);

    expect(result?.type).toBe("video");
    expect(result?.error).toBeUndefined();
    if (result?.type === "video" || result?.type === "generic") {
      expect(result.link).toBe(expectedLink);
    }
    expect(result?.intrinsicSize).toEqual({ w: 560, h: 315 });
  });

  it("should still flag unsupported Vimeo link formats", () => {
    const result = getEmbedLink(
      "https://vimeo.com/channels/staffpicks/76979871",
    );

    expect(result?.error).toBeInstanceOf(URIError);
  });
});
