import { useApp } from "../../packages/excalidraw/components/App";
import { TOOL_TYPE } from "../../packages/excalidraw/constants";

export const Toolbar = () => {
  const app = useApp();

  return (
    <>
      <div>
        <button
          onClick={() => {
            app.setActiveTool({ type: TOOL_TYPE.selection });
          }}
        >
          selection
        </button>
        <button
          onClick={() => {
            app.setActiveTool({ type: TOOL_TYPE.hand });
          }}
        >
          hand
        </button>
        <button
          onClick={() => {
            app.setActiveTool({ type: TOOL_TYPE.freedraw });
          }}
        >
          draw
        </button>
        <button onClick={() => app.setActiveTool({ type: TOOL_TYPE.text })}>
          text
        </button>
        <button onClick={() => app.setActiveTool({ type: TOOL_TYPE.image })}>
          image
        </button>
      </div>
    </>
  );
};
