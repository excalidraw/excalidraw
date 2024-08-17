import StatsDragInput from "./DragInput";
import type Scene from "../../scene/Scene";
import type { AppState } from "../../types";
import { getStepSizedValue } from "./utils";
import { getNormalizedGridSize } from "../../scene";

//zsviczian
//this is essentially a copy of CanvasGrid.tsx but includes gridSize
//this should really be implemented in CanvasGrid,
//however from a longterm merging/alignment perspective
//I thouhgt it is better to keep this in a separate file
//until the function is implemented in excalidraw master

interface PositionProps {
  property: "gridSize";
  scene: Scene;
  appState: AppState;
  setAppState: React.Component<any, AppState>["setState"];
}

const GRID_SIZE = 20;

const CanvasGridSize = ({
  property,
  scene,
  appState,
  setAppState,
}: PositionProps) => {
  return (
    <StatsDragInput
      label="Grid size"
      sensitivity={8}
      elements={[]}
      dragInputCallback={({
        nextValue,
        instantChange,
        shouldChangeByStepSize,
        setInputValue,
      }) => {
        setAppState((state) => {
          let nextGridSize;

          if (nextValue) {
            nextGridSize = nextValue;
          } else if (instantChange) {
            nextGridSize = shouldChangeByStepSize
              ? getStepSizedValue(
                  state.gridSize + GRID_SIZE * Math.sign(instantChange),
                  GRID_SIZE,
                )
              : state.gridSize + instantChange;
          }

          if (!nextGridSize) {
            setInputValue(state.gridSize);
            return null;
          }

          nextGridSize = getNormalizedGridSize(nextGridSize);
          setInputValue(nextGridSize);
          return {
            gridSize: nextGridSize,
          };
        });
      }}
      scene={scene}
      value={appState.gridSize}
      property={property}
      appState={appState}
    />
  );
};

export default CanvasGridSize;
