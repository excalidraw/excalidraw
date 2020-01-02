import React from "react";
import ReactDOM from "react-dom";
import rough from "roughjs/dist/rough.umd.js";

import "./styles.css";

var elements = [];

function newElement(type, x, y) {
  const element = {
    type: type,
    x: x,
    y: y,
    width: 0,
    height: 0
  };
  generateShape(element);
  return element;
}

function rotate(x1, y1, x2, y2, angle) {
  // 𝑎′𝑥=(𝑎𝑥−𝑐𝑥)cos𝜃−(𝑎𝑦−𝑐𝑦)sin𝜃+𝑐𝑥
  // 𝑎′𝑦=(𝑎𝑥−𝑐𝑥)sin𝜃+(𝑎𝑦−𝑐𝑦)cos𝜃+𝑐𝑦.
  // https://math.stackexchange.com/questions/2204520/how-do-i-rotate-a-line-segment-in-a-specific-point-on-the-line
  return [
    (x1 - x2) * Math.cos(angle) - (y1 - y2) * Math.sin(angle) + x2,
    (x1 - x2) * Math.sin(angle) + (y1 - y2) * Math.cos(angle) + y2
  ];
}

var generator = rough.generator();

function generateShape(element) {
  if (element.type === "selection") {
    element.draw = (rc, context) => {
      context.fillStyle = "rgba(0, 0, 255, 0.10)";
      context.fillRect(element.x, element.y, element.width, element.height);
    };
  } else if (element.type === "rectangle") {
    const shape = generator.rectangle(
      element.x,
      element.y,
      element.width,
      element.height
    );
    element.draw = (rc, context) => {
      rc.draw(shape);
    };
  } else if (element.type === "ellipse") {
    const shape = generator.ellipse(
      element.x + element.width / 2,
      element.y + element.height / 2,
      element.width,
      element.height
    );
    element.draw = (rc, context) => {
      rc.draw(shape);
    };
  } else if (element.type === "arrow") {
    const x1 = element.x;
    const y1 = element.y;
    const x2 = element.x + element.width;
    const y2 = element.y + element.height;

    const size = 30; // pixels
    const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    // Scale down the arrow until we hit a certain size so that it doesn't look weird
    const minSize = Math.min(size, distance / 2);
    const xs = x2 - ((x2 - x1) / distance) * minSize;
    const ys = y2 - ((y2 - y1) / distance) * minSize;

    const angle = 20; // degrees
    const [x3, y3] = rotate(xs, ys, x2, y2, (-angle * Math.PI) / 180);
    const [x4, y4] = rotate(xs, ys, x2, y2, (angle * Math.PI) / 180);

    const shapes = [
      generator.line(x1, y1, x2, y2),
      generator.line(x3, y3, x2, y2),
      generator.line(x4, y4, x2, y2)
    ];

    element.draw = (rc, context) => {
      shapes.forEach(shape => rc.draw(shape));
    };
    return;
  } else if (element.type === "text") {
    if (element.text === undefined) {
      element.text = prompt("What text do you want?");
    }
    element.draw = (rc, context) => {
      context.font = "20px Virgil";
      const measure = context.measureText(element.text);
      const height =
        measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent;
      context.fillText(
        element.text,
        element.x - measure.width / 2,
        element.y + measure.actualBoundingBoxAscent - height / 2
      );
    };
  } else {
    throw new Error("Unimplemented type " + element.type);
  }
}

function App() {
  const [draggingElement, setDraggingElement] = React.useState(null);
  const [elementType, setElementType] = React.useState("selection");
  const [selectedElements, setSelectedElements] = React.useState([]);
  function ElementOption({ type, children }) {
    return (
      <label>
        <input
          type="radio"
          checked={elementType === type}
          onChange={() => setElementType(type)}
        />
        {children}
      </label>
    );
  }
  return (
    <div>
      <ElementOption type="rectangle">Rectangle</ElementOption>
      <ElementOption type="ellipse">Ellipse</ElementOption>
      <ElementOption type="arrow">Arrow</ElementOption>
      <ElementOption type="text">Text</ElementOption>
      <ElementOption type="selection">Selection</ElementOption>
      <canvas
        id="canvas"
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={e => {
          const element = newElement(
            elementType,
            e.clientX - e.target.offsetLeft,
            e.clientY - e.target.offsetTop
          );
          elements.push(element);
          setDraggingElement(element);
          drawScene();
        }}
        onMouseUp={e => {
          setDraggingElement(null);
          drawScene();
        }}
        onMouseMove={e => {
          if (!draggingElement) return;
          let width = e.clientX - e.target.offsetLeft - draggingElement.x;
          let height = e.clientY - e.target.offsetTop - draggingElement.y;
          draggingElement.width = width;
          // Make a perfect square or circle when shift is enabled
          draggingElement.height = e.shiftKey ? width : height;
          generateShape(draggingElement);
          drawScene();
        }}
      />
    </div>
  );
}
const rootElement = document.getElementById("root");

function drawScene() {
  ReactDOM.render(<App />, rootElement);

  const canvas = document.getElementById("canvas");
  const rc = rough.canvas(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);

  elements.forEach(element => {
    element.draw(rc, context);
    if (true || element.isSelected) {
      const margin = 4;
      context.setLineDash([8, 4]);
      context.strokeRect(
        element.x - margin,
        element.y - margin,
        element.width + margin * 2,
        element.height + margin * 2
      );
      context.setLineDash([]);
    }
  });
}

drawScene();
