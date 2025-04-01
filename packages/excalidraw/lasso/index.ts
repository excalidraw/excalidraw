import {
  type GlobalPoint,
  type LineSegment,
  pointFrom,
} from "@excalidraw/math";

import { getElementLineSegments } from "@excalidraw/element/bounds";
import { LinearElementEditor } from "@excalidraw/element/linearElementEditor";
import {
  isFrameLikeElement,
  isLinearElement,
  isTextElement,
} from "@excalidraw/element/typeChecks";

import { getFrameChildren } from "@excalidraw/element/frame";
import { selectGroupsForSelectedElements } from "@excalidraw/element/groups";

import { getContainerElement } from "@excalidraw/element/textElement";

import { arrayToMap, easeOut, promiseTry } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { type AnimationFrameHandler } from "../animation-frame-handler";

import { AnimatedTrail } from "../animated-trail";

import { WorkerPool } from "../workers";

import { updateSelection } from "./utils";

import type App from "../components/App";
import type { LassoWorkerInput, LassoWorkerOutput } from "./types";

export class LassoTrail extends AnimatedTrail {
  private intersectedElements: Set<ExcalidrawElement["id"]> = new Set();
  private enclosedElements: Set<ExcalidrawElement["id"]> = new Set();
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

  async startPath(x: number, y: number, keepPreviousSelection = false) {
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

  addPointToPath = async (
    x: number,
    y: number,
    keepPreviousSelection = false,
  ) => {
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

    await this.updateSelection();
  };

  private updateSelection = async () => {
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

      const workerPool = await getOrCreateWorkerPool();
      const result = await workerPool.postMessage(message, {});

      const { selectedElementIds } = result;
      if (!selectedElementIds || !Array.isArray(selectedElementIds)) {
        return;
      }

      this.selectElementsFromIds(selectedElementIds);
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

    getOrCreateWorkerPool()
      .then((workerPool) => {
        workerPool.clear();
      })
      .catch((error) => {
        console.error("Failed to clear worker pool", error);
      });
  }
}

let lassoWorker: Promise<typeof import("./lasso-worker.chunk")> | null = null;

const lazyLoadLassoWorkerChunk = async () => {
  if (!lassoWorker) {
    lassoWorker = import("./lasso-worker.chunk");
  }

  return lassoWorker;
};

let workerPool: Promise<
  WorkerPool<LassoWorkerInput, LassoWorkerOutput>
> | null = null;

const getOrCreateWorkerPool = async () => {
  if (!workerPool) {
    workerPool = promiseTry(async () => {
      if (typeof Worker !== "undefined") {
        const { WorkerUrl } = await lazyLoadLassoWorkerChunk();

        return WorkerPool.create<LassoWorkerInput, LassoWorkerOutput>(
          WorkerUrl,
        );
      }
      return WorkerPolyfillPool.create() as unknown as WorkerPool<
        LassoWorkerInput,
        LassoWorkerOutput
      >;
    });
  }
  return workerPool;
};

class WorkerPolyfillPool {
  static create() {
    return new WorkerPolyfillPool();
  }

  async postMessage(data: LassoWorkerInput): Promise<LassoWorkerOutput> {
    return new Promise((resolve, reject) => {
      try {
        const selectedElementIds = updateSelection(data);
        resolve(selectedElementIds);
      } catch (error) {
        reject(error);
      }
    });
  }

  clear() {
    // no-op for polyfill
  }
}
