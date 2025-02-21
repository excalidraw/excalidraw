import { GlobalPoint, pointFrom } from "../../math";
import { AnimatedTrail } from "../animated-trail";
import { AnimationFrameHandler } from "../animation-frame-handler";
import App from "../components/App";
import { isFrameLikeElement } from "../element/typeChecks";
import { ExcalidrawElement } from "../element/types";
import { getFrameChildren } from "../frame";
import { selectGroupsForSelectedElements } from "../groups";
import { easeOut } from "../utils";
import { LassoWorkerInput, LassoWorkerOutput } from "./worker";

export class LassoTrail extends AnimatedTrail {
  private intersectedElements: Set<ExcalidrawElement["id"]> = new Set();
  private enclosedElements: Set<ExcalidrawElement["id"]> = new Set();
  private worker: Worker | null = null;

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      animateTrail: true,
      streamline: 0.4,
      sizeMapping: (c) => {
        const DECAY_TIME = Infinity;
        const DECAY_LENGTH = 5000;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
      fill: () => "rgba(0,118,255)",
    });
  }

  startPath(x: number, y: number) {
    super.startPath(x, y);
    this.intersectedElements.clear();
    this.enclosedElements.clear();

    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event: MessageEvent<LassoWorkerOutput>) => {
      const { selectedElementIds } = event.data;

      this.app.setState((prevState) => {
        const nextSelectedElementIds = selectedElementIds.reduce((acc, id) => {
          acc[id] = true;
          return acc;
        }, {} as Record<ExcalidrawElement["id"], true>);

        for (const [id] of Object.entries(nextSelectedElementIds)) {
          const element = this.app.scene.getNonDeletedElement(id);
          if (element && isFrameLikeElement(element)) {
            const elementsInFrame = getFrameChildren(
              this.app.scene.getNonDeletedElementsMap(),
              element.id,
            );
            for (const child of elementsInFrame) {
              delete nextSelectedElementIds[child.id];
            }
          }
        }

        const nextSelection = selectGroupsForSelectedElements(
          {
            editingGroupId: prevState.editingGroupId,
            selectedElementIds: nextSelectedElementIds,
          },
          this.app.scene.getNonDeletedElements(),
          prevState,
          this.app,
        );

        return {
          selectedElementIds: nextSelection.selectedElementIds,
          selectedGroupIds: nextSelection.selectedGroupIds,
        };
      });
    };

    this.worker.onerror = (error) => {
      console.error("Worker error:", error);
    };
  }

  addPointToPath = (x: number, y: number) => {
    super.addPointToPath(x, y);

    this.app.setState({
      lassoSelection: {
        points:
          (this.getCurrentTrail()?.originalPoints?.map((p) =>
            pointFrom<GlobalPoint>(p[0], p[1]),
          ) as readonly GlobalPoint[]) ?? null,
      },
    });

    this.updateSelection();
  };

  private updateSelection = () => {
    const lassoPath = super
      .getCurrentTrail()
      ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1]));

    if (lassoPath) {
      const message: LassoWorkerInput = {
        lassoPath,
        elements: this.app.visibleElements,
        intersectedElements: this.intersectedElements,
        enclosedElements: this.enclosedElements,
      };

      this.worker?.postMessage(message);
    }
  };

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.intersectedElements.clear();
    this.enclosedElements.clear();
    this.app.setState({
      lassoSelection: null,
    });
    this.worker?.terminate();
  }
}
