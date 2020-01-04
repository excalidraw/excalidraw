import React, {
  createContext,
  useReducer,
  useCallback,
  Dispatch,
  useContext,
  useState,
  useRef,
  useEffect
} from "react";
import rough from "roughjs/bin/wrappers/rough";
import { RoughCanvas } from "roughjs/bin/canvas";
import { Drawable } from "roughjs/bin/core";

type CanvasProps = {
  width?: number;
  height?: number;
  children?: React.ReactNode;
  backgroundColor?: string;
};

type CanvasState = {
  scrollX: number;
  scrollY: number;
  scale: number;
};

type CanvasDraw = {
  context: CanvasRenderingContext2D;
  rc: RoughCanvas;
};

type MouseEventListener = (ev: React.MouseEvent) => void;

type CanvasEventListeners = {
  mouseMoveListeners: MouseEventListener[];
  mouseDownListeners: MouseEventListener[];
};

const CanvasEventListenersContext = createContext<CanvasEventListeners>({
  mouseDownListeners: [],
  mouseMoveListeners: []
});

const CanvasDrawContext = createContext<CanvasDraw | null>(null);

const CanvasStateContext = createContext<CanvasState>({
  scale: 1,
  scrollX: 0,
  scrollY: 0
});

const CanvasDispatchContext = createContext<Dispatch<Action>>(() => {});

type Action =
  | { type: "shift-scroll"; dx: number; dy: number }
  | { type: "set-scale"; scale: number };

function reducer(state: CanvasState, action: Action): CanvasState {
  switch (action.type) {
    case "set-scale":
      return {
        ...state,
        scale: action.scale
      };
    case "shift-scroll":
      return {
        ...state,
        scrollX: state.scrollX + action.dx,
        scrollY: state.scrollY + action.dy
      };
    default:
      return state;
  }
}

export function Canvas({
  width,
  height,
  children,
  backgroundColor
}: CanvasProps) {
  const eventListenersRef = useRef<CanvasEventListeners>({
    mouseDownListeners: [],
    mouseMoveListeners: []
  });

  const [state, dispatch] = useReducer(reducer, {
    scrollX: 0,
    scrollY: 0,
    scale: 1
  });

  const [canvasDraw, setCanvasDraw] = useState<CanvasDraw | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    dispatch({ type: "shift-scroll", dx: -e.deltaX, dy: -e.deltaY });
  }, []);

  const handleCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (canvas) {
      setCanvasDraw({
        context: canvas.getContext("2d")!,
        rc: rough.canvas(canvas)
      });
    } else {
      setCanvasDraw(null);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    eventListenersRef.current.mouseDownListeners.forEach(fn => fn(e));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    eventListenersRef.current.mouseMoveListeners.forEach(fn => fn(e));
  }, []);

  return (
    <CanvasEventListenersContext.Provider value={eventListenersRef.current}>
      <CanvasDrawContext.Provider value={canvasDraw}>
        <CanvasDispatchContext.Provider value={dispatch}>
          <CanvasStateContext.Provider value={state}>
            <canvas
              id="canvas"
              ref={handleCanvasRef}
              onWheel={handleWheel}
              width={width}
              height={height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
            >
              {canvasDraw && (
                <CanvasBackground
                  context={canvasDraw.context}
                  color={backgroundColor}
                />
              )}
            </canvas>

            {children}
          </CanvasStateContext.Provider>
        </CanvasDispatchContext.Provider>
      </CanvasDrawContext.Provider>
    </CanvasEventListenersContext.Provider>
  );
}

function CanvasBackground({
  context,
  color
}: {
  context: CanvasRenderingContext2D;
  color?: string;
}) {
  const fillStyle = context.fillStyle;
  if (typeof color === "string") {
    context.fillStyle = color;
    context.fillRect(-0.5, -0.5, context.canvas.width, context.canvas.height);
  } else {
    context.clearRect(-0.5, -0.5, context.canvas.width, context.canvas.height);
  }
  context.fillStyle = fillStyle;

  return null;
}

function useCanvasState(): CanvasState {
  return useContext(CanvasStateContext);
}

function useCanvasDispatch(): Dispatch<Action> {
  return useContext(CanvasDispatchContext);
}

function useCanvasEventListener(): CanvasEventListeners {
  return useContext(CanvasEventListenersContext);
}

function useCanvasDraw(): CanvasDraw | null {
  return useContext(CanvasDrawContext);
}

type CanvasElementProps = {
  x: number;
  y: number;
  hitTest(targetX: number, targetY: number): boolean;
  getShape?(rc: RoughCanvas): Drawable;
  draw(
    rc: RoughCanvas,
    context: CanvasRenderingContext2D,
    shape: Drawable | undefined
  ): void;
  onTap?(ev: React.MouseEvent): void;
  onHover?(ev: React.MouseEvent): void;
};

export function CanvasElement({
  x,
  y,
  getShape,
  draw,
  hitTest,
  onTap,
  onHover
}: CanvasElementProps) {
  const canvasDraw = useCanvasDraw();
  const { scrollX, scrollY, scale } = useCanvasState();
  const shapeRef = useRef<Drawable | undefined>(undefined);
  const { mouseDownListeners, mouseMoveListeners } = useCanvasEventListener();

  useEffect(() => {
    const mouseDownHandler: MouseEventListener = e => {
      if (onTap && e.target instanceof HTMLElement) {
        const targetX = e.clientX - e.target.offsetLeft - scrollX;
        const targetY = e.clientY - e.target.offsetTop - scrollY;
        if (hitTest(targetX, targetY)) onTap(e);
      }
    };
    mouseDownListeners.push(mouseDownHandler);

    const mouseMoveHandler: MouseEventListener = e => {
      if (onHover && e.target instanceof HTMLElement) {
        const targetX = e.clientX - e.target.offsetLeft - scrollX;
        const targetY = e.clientY - e.target.offsetTop - scrollY;
        if (hitTest(targetX, targetY)) onHover(e);
      }
    };
    mouseMoveListeners.push(mouseMoveHandler);

    return () => {
      const mouseDownIdx = mouseDownListeners.indexOf(mouseDownHandler);
      mouseDownListeners.splice(mouseDownIdx, 1);
      const mouseMoveIdx = mouseMoveListeners.indexOf(mouseMoveHandler);
      mouseMoveListeners.splice(mouseMoveIdx, 1);
    };
  }, [
    hitTest,
    mouseDownListeners,
    mouseMoveListeners,
    onHover,
    onTap,
    scrollX,
    scrollY
  ]);

  useEffect(() => {
    if (canvasDraw && getShape) shapeRef.current = getShape(canvasDraw.rc);
  }, [getShape, canvasDraw]);

  if (!canvasDraw) {
    return null;
  }

  if (!shapeRef.current && getShape) {
    shapeRef.current = getShape(canvasDraw.rc);
  }

  const { rc, context } = canvasDraw;
  context.translate(x + scrollX, y + scrollY);
  draw(rc, context, shapeRef.current);
  context.translate(-x - scrollX, -y - scrollY);

  return null;
}
