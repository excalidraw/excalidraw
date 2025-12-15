import {
  DiagramToCodePlugin,
  exportToBlob,
  getTextFromElements,
  MIME_TYPES,
  TTDDialog,
  OpenRouterClient,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const appState = excalidrawAPI.getAppState();

          if (!OpenRouterClient.getApiKey()) {
            throw new Error("OpenRouter API Key not found. Please set it in the Text-to-Diagram dialog first.");
          }

          const blob = await exportToBlob({
            elements: children,
            appState: {
              ...appState,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor,
            },
            exportingFrame: frame,
            files: excalidrawAPI.getFiles(),
            mimeType: MIME_TYPES.jpg,
          });

          const dataURL = await getDataURL(blob);

          const systemPrompt = `You are an expert web developer specializing in converting wireframes and mockups into pixel-perfect HTML and CSS.
You will be provided with an image of a UI design. Your task is to generate the HTML and CSS code to reproduce this design as closely as possible.
Rules:
- Use standard HTML5 and CSS3.
- You may use TailwindCSS if it helps, or vanilla CSS.
- Return ONLY the HTML code. Do not wrap it in backticks or markdown blocks.
- Ensure the design is responsive and looks good.
- The output should be a single HTML file with embedded CSS.`;

          try {
            const response = await OpenRouterClient.generateCompletion([
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Turn this wireframe into code."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: dataURL
                    }
                  }
                ]
              }
            ], "anthropic/claude-sonnet-4.5"); // Using a vision capable model

            let html = response;
            // enhanced cleanup
            if (html.includes("```html")) {
              html = html.split("```html")[1].split("```")[0];
            } else if (html.includes("```")) {
              html = html.split("```")[1].split("```")[0];
            }

            return { html: html.trim() };

          } catch (error: any) {
            console.error("AI Generation Error:", error);
            throw new Error(error.message || "Generation failed");
          }
        }}
      />

      <TTDDialog
        onTextSubmit={async (input) => {
          if (!OpenRouterClient.getApiKey()) {
            throw new Error("Please set your OpenRouter API Key in the settings.");
          }

          const systemPrompt = `You are a helpful assistant that generates Mermaid diagram syntax from text descriptions.
Rules:
- Return ONLY the Mermaid syntax.
- Do not output any markdown formatting (backticks).
- If the user asks for a flowchart, use 'flowchart TD'.
- If the user asks for a sequence diagram, use 'sequenceDiagram'.
- If class diagram, use 'classDiagram'.
- Ensure the syntax is valid.`;

          try {
            const response = await OpenRouterClient.generateCompletion([
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: input
              }
            ]);

            let generatedResponse = response;
            if (generatedResponse.includes("```mermaid")) {
              generatedResponse = generatedResponse.split("```mermaid")[1].split("```")[0];
            } else if (generatedResponse.includes("```")) {
              generatedResponse = generatedResponse.split("```")[1].split("```")[0];
            }

            return { generatedResponse: generatedResponse.trim() };
          } catch (err: any) {
            console.error(err);
            return { error: new Error(err.message || "Request failed") };
          }
        }}
      />
    </>
  );
};
