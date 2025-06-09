import { useState, useEffect } from "react";

export const FreedrawDebugSliders = () => {
  const [streamline, setStreamline] = useState(0.62);
  const [simplify, setSimplify] = useState(0.3);

  useEffect(() => {
    if (!window.h) {
      window.h = {} as any;
    }
    if (!window.h.debugFreedraw) {
      window.h.debugFreedraw = { streamline: 0.62, simplify: 0.3 };
    }

    setStreamline(window.h.debugFreedraw.streamline);
    setSimplify(window.h.debugFreedraw.simplify);
  }, []);

  const handleStreamlineChange = (value: number) => {
    setStreamline(value);
    if (window.h && window.h.debugFreedraw) {
      window.h.debugFreedraw.streamline = value;
    }
  };

  const handleSimplifyChange = (value: number) => {
    setSimplify(value);
    if (window.h && window.h.debugFreedraw) {
      window.h.debugFreedraw.simplify = value;
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "rgba(255, 255, 255, 0.9)",
        padding: "10px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontSize: "12px",
        fontFamily: "monospace",
      }}
    >
      <div>
        <label>
          Streamline: {streamline.toFixed(2)}
          <br />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={streamline}
            onChange={(e) => handleStreamlineChange(parseFloat(e.target.value))}
            style={{ width: "150px" }}
          />
        </label>
      </div>
      <div>
        <label>
          Simplify: {simplify.toFixed(2)}
          <br />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={simplify}
            onChange={(e) => handleSimplifyChange(parseFloat(e.target.value))}
            style={{ width: "150px" }}
          />
        </label>
      </div>
    </div>
  );
};
