import { useEffect, useRef, useState } from "react";
import { t } from "../../i18n";
import { useApp } from "../App";
import { Dialog } from "../Dialog";
import { TextField } from "../TextField";
import Trans from "../Trans";
import {
  CloseIcon,
  RedoIcon,
  ZoomInIcon,
  ZoomOutIcon,
  playerPlayIcon,
  playerStopFilledIcon,
} from "../icons";
import { NonDeletedExcalidrawElement } from "../../element/types";
import { convertToExcalidrawElements } from "../../data/transform";
import { exportToCanvas } from "../../packages/utils";
import { DEFAULT_EXPORT_PADDING } from "../../constants";
import { canvasToBlob } from "../../data/blob";

const testResponse = `{
  "error": false,
  "data": [
    {
      "type": "ellipse",
      "x": 200,
      "y": 200,
      "width": 100,
      "height": 100,
      "strokeColor": "transparent",
      "backgroundColor": "yellow",
      "strokeWidth": 2
    },
    {
      "type": "line",
      "x": 300,
      "y": 250,
      "points": [
        [
          0,
          0
        ],
        [
          70,
          0
        ]
      ],
      "width": -70,
      "height": 0,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 293.30127018922195,
      "y": 275,
      "points": [
        [
          0,
          0
        ],
        [
          60.62177826491069,
          35
        ]
      ],
      "width": -60.62177826491069,
      "height": -35,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 275,
      "y": 293.30127018922195,
      "points": [
        [
          0,
          0
        ],
        [
          35,
          60.62177826491069
        ]
      ],
      "width": -35,
      "height": -60.62177826491069,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 250,
      "y": 300,
      "points": [
        [
          0,
          0
        ],
        [
          0,
          70
        ]
      ],
      "width": 0,
      "height": -70,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 225,
      "y": 293.30127018922195,
      "points": [
        [
          0,
          0
        ],
        [
          -34.99999999999997,
          60.62177826491069
        ]
      ],
      "width": -34.99999999999997,
      "height": -60.62177826491069,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 206.69872981077805,
      "y": 275,
      "points": [
        [
          0,
          0
        ],
        [
          -60.62177826491069,
          35
        ]
      ],
      "width": -60.62177826491069,
      "height": -35,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 200,
      "y": 250,
      "points": [
        [
          0,
          0
        ],
        [
          -70,
          2.842170943040401e-14
        ]
      ],
      "width": -70,
      "height": -2.842170943040401e-14,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 206.69872981077805,
      "y": 225,
      "points": [
        [
          0,
          0
        ],
        [
          -60.62177826491069,
          -34.99999999999997
        ]
      ],
      "width": -60.62177826491069,
      "height": -34.99999999999997,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 224.99999999999997,
      "y": 206.69872981077808,
      "points": [
        [
          0,
          0
        ],
        [
          -35.00000000000003,
          -60.62177826491069
        ]
      ],
      "width": -35.00000000000003,
      "height": -60.62177826491069,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 250,
      "y": 200,
      "points": [
        [
          0,
          0
        ],
        [
          -2.842170943040401e-14,
          -70
        ]
      ],
      "width": -2.842170943040401e-14,
      "height": -70,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 275,
      "y": 206.69872981077808,
      "points": [
        [
          0,
          0
        ],
        [
          35,
          -60.621778264910716
        ]
      ],
      "width": -35,
      "height": -60.621778264910716,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    },
    {
      "type": "line",
      "x": 293.3012701892219,
      "y": 224.99999999999997,
      "points": [
        [
          0,
          0
        ],
        [
          60.621778264910745,
          -35.00000000000003
        ]
      ],
      "width": -60.621778264910745,
      "height": -35.00000000000003,
      "strokeColor": "yellow",
      "backgroundColor": "transparent",
      "strokeWidth": 5
    }
  ]
}`;

async function fetchData(
  prompt: string,
): Promise<readonly NonDeletedExcalidrawElement[]> {
  const response = await fetch(
    `http://localhost:3015/v1/ai/text-to-excalidraw/generate`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    },
  );

  const result = await response.json();

  if (result.error) {
    alert("Oops!");
    return [];
  }

  return convertToExcalidrawElements(result.data);
}

export const TextToExcalidraw = () => {
  const app = useApp();

  const [prompt, setPrompt] = useState("");
  const [isPanelOpen, setPanelOpen] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [data, setData] = useState<
    readonly NonDeletedExcalidrawElement[] | null
  >(null);

  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(
    null,
  );

  const containerRef = useRef<HTMLDivElement>(null);

  const onClose = () => {
    app.setOpenDialog(null);
  };

  const onSubmit = async () => {
    setPanelOpen(true);
    setLoading(true);

    const elements = await fetchData(prompt);

    setData(elements);

    const canvas = await exportToCanvas({
      elements,
      files: {},
      exportPadding: DEFAULT_EXPORT_PADDING,
    });

    await canvasToBlob(canvas);

    setPreviewCanvas(canvas);
    setLoading(false);
  };

  const onInsert = async () => {
    if (data) {
      app.addElementsFromPasteOrLibrary({
        elements: data,
        files: {},
        position: "center",
        fitToContent: true,
      });

      onClose();
    }
  };

  useEffect(() => {
    if (containerRef.current && previewCanvas) {
      containerRef.current.replaceChildren(previewCanvas);
    }
  }, [previewCanvas]);

  // exportToCanvas([], {}, {}, {});
  // exportToSvg([], {exportBackground}, {}, {})

  return (
    <div
      style={{
        position: "absolute",
        top: "6.5rem",
        pointerEvents: "auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div
        className="Island"
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          boxSizing: "border-box",
          gap: "0.75rem",
          alignItems: "center",
          height: 48,
          padding: "0.5rem",
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          type="text"
          style={{
            flexGrow: 1,
            height: "100%",
            boxSizing: "border-box",
            border: 0,
            outline: "none",
          }}
          placeholder="How can I help you today?"
        />
        <button
          style={{
            cursor: "pointer",
            height: "100%",
            border: "none",
            background: "white",
            aspectRatio: "1/1",
            padding: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{ width: "1.25rem", height: "1.25rem", color: "#1B1B1F" }}
          >
            {CloseIcon}
          </div>
        </button>
        <div
          style={{ background: "#D6D6D6", width: 1, height: "1.5rem" }}
        ></div>
        <button
          style={{
            cursor: "pointer",
            height: "100%",
            border: "none",
            aspectRatio: "1/1",
            padding: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#6965DB",
            borderRadius: "0.5rem",
          }}
          onClick={onSubmit}
        >
          <div style={{ width: "1.25rem", height: "1.25rem", color: "white" }}>
            {isLoading ? playerStopFilledIcon : playerPlayIcon}
          </div>
        </button>
      </div>

      {isPanelOpen && (
        <div
          className="Island"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "row",
            height: 400,
            boxSizing: "border-box",
          }}
        >
          {isLoading ? (
            "loading"
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                ref={containerRef}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                }}
              />
              <div
                style={{
                  borderTop: "1px solid #F0EFFF",
                  padding: "0.75rem",
                  display: "flex",
                  flexDirection: "row",
                  gap: "0.75rem",
                }}
              >
                <button
                  style={{
                    cursor: "pointer",
                    width: 32,
                    height: "100%",
                    border: "none",
                    aspectRatio: "1/1",
                    padding: 0,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#F5F5F9",
                    borderRadius: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: "1.25rem",
                      height: "1.25rem",
                      color: "#1B1B1F",
                    }}
                  >
                    {RedoIcon}
                  </div>
                </button>

                <div style={{ width: 32, height: "100%", display: "flex" }}>
                  <button
                    style={{
                      cursor: "pointer",
                      width: 32,
                      height: "100%",
                      border: "none",
                      aspectRatio: "1/1",
                      padding: 0,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "#F5F5F9",
                      borderRadius: "0.5rem 0 0 0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "1.25rem",
                        height: "1.25rem",
                        color: "#1B1B1F",
                      }}
                    >
                      {ZoomOutIcon}
                    </div>
                  </button>
                  <button
                    style={{
                      cursor: "pointer",
                      width: 32,
                      height: "100%",
                      border: "none",
                      aspectRatio: "1/1",
                      padding: 0,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "#F5F5F9",
                      borderRadius: "0 0.5rem 0.5rem 0",
                    }}
                  >
                    <div
                      style={{
                        width: "1.25rem",
                        height: "1.25rem",
                        color: "#1B1B1F",
                      }}
                    >
                      {ZoomInIcon}
                    </div>
                  </button>
                </div>
                <div style={{ flexGrow: 1 }}></div>
                <button
                  style={{
                    cursor: "pointer",
                    height: "100%",
                    border: "none",
                    padding: "0.5rem 1rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#6965DB",
                    borderRadius: "0.5rem",
                    color: "white",
                  }}
                  onClick={onInsert}
                >
                  Insert into scene &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
