import { type GlobalPoint, type LineSegment, pointFrom } from "../../math";
import { AnimatedTrail } from "../animated-trail";
import { type AnimationFrameHandler } from "../animation-frame-handler";

import { getElementLineSegments } from "../element/bounds";
import { LinearElementEditor } from "../element/linearElementEditor";
import {
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
} from "../element/typeChecks";

import { getFrameChildren } from "../frame";
import { selectGroupsForSelectedElements } from "../groups";
import { arrayToMap, easeOut } from "../utils";

import LassoWorker from "./worker?worker&inline";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "../element/types";
import type App from "../components/App";
import type { LassoWorkerInput, LassoWorkerOutput } from "./types";
import { getContainerElement } from "../element/textElement";

export class LassoTrail extends AnimatedTrail {
  private intersectedElements: Set<ExcalidrawElement["id"]> = new Set();
  private enclosedElements: Set<ExcalidrawElement["id"]> = new Set();
  private worker: Worker | null = null;
  private elementsSegments: Map<string, LineSegment<GlobalPoint>[]> | null =
    null;
  private keepPreviousSelection: boolean = false;

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

  startPath(x: number, y: number, keepPreviousSelection = false) {
    // clear any existing trails just in case
    this.endPath();

    super.startPath(x, y);
    this.intersectedElements.clear();
    this.enclosedElements.clear();

    this.keepPreviousSelection = keepPreviousSelection;

    if (!this.keepPreviousSelection) {
      this.app.setState({
        selectedElementIds: {},
        selectedGroupIds: {},
        selectedLinearElement: null,
      });
    }

    try {
      this.worker = new LassoWorker();

      this.worker.onmessage = (event: MessageEvent<LassoWorkerOutput>) => {
        const { selectedElementIds } = event.data;
        this.selectElementsFromIds(selectedElementIds);
      };

      this.worker.onerror = (error) => {
        console.error("Worker error:", error);
      };
    } catch (error) {
      console.error("Failed to start worker", error);
    }
  }

  selectElementsFromIds = (ids: string[]) => {
    this.app.setState((prevState) => {
      const nextSelectedElementIds = ids.reduce((acc, id) => {
        acc[id] = true;
        return acc;
      }, {} as Record<ExcalidrawElement["id"], true>);

      if (this.keepPreviousSelection) {
        for (const id of Object.keys(prevState.selectedElementIds)) {
          nextSelectedElementIds[id] = true;
        }
      }

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

        if (element && isTextElement(element)) {
          const container = getContainerElement(
            element,
            this.app.scene.getNonDeletedElementsMap(),
          );
          if (container) {
            nextSelectedElementIds[container.id] = true;
            delete nextSelectedElementIds[element.id];
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

      const selectedIds = [...Object.keys(nextSelection.selectedElementIds)];
      const selectedGroupIds = [...Object.keys(nextSelection.selectedGroupIds)];

      return {
        selectedElementIds: nextSelection.selectedElementIds,
        selectedGroupIds: nextSelection.selectedGroupIds,
        selectedLinearElement:
          selectedIds.length === 1 &&
          !selectedGroupIds.length &&
          isLinearElement(this.app.scene.getNonDeletedElement(selectedIds[0]))
            ? new LinearElementEditor(
                this.app.scene.getNonDeletedElement(
                  selectedIds[0],
                ) as NonDeleted<ExcalidrawLinearElement>,
              )
            : null,
      };
    });
  };

  addPointToPath = (x: number, y: number, keepPreviousSelection = false) => {
    super.addPointToPath(x, y);

    this.keepPreviousSelection = keepPreviousSelection;

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

    if (!this.elementsSegments) {
      this.elementsSegments = new Map();
      const visibleElementsMap = arrayToMap(this.app.visibleElements);
      for (const element of this.app.visibleElements) {
        const segments = getElementLineSegments(element, visibleElementsMap);
        this.elementsSegments.set(element.id, segments);
      }
    }

    if (lassoPath) {
      const message: LassoWorkerInput = {
        lassoPath,
        elements: this.app.visibleElements,
        elementsSegments: this.elementsSegments,
        intersectedElements: this.intersectedElements,
        enclosedElements: this.enclosedElements,
        simplifyDistance: 5 / this.app.state.zoom.value,
      };

      this.worker?.postMessage(message);
    }
  };

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.intersectedElements.clear();
    this.enclosedElements.clear();
    this.elementsSegments = null;
    this.app.setState({
      lassoSelection: null,
    });
    this.worker?.terminate();
  }
}
