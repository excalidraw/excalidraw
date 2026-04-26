import { t } from "../i18n";
import { ToolButton } from "./ToolButton";

import "./ShapeRecognitionToggle.scss";

import type App from "./App";

// Simple wand SVG icon
const WandIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: 20, height: 20 }}
  >
    <path d="M15 4l5 5L8 21l-5-2 2-5L15 4z" />
    <line x1="3" y1="3" x2="5" y2="5" />
    <line x1="19" y1="3" x2="21" y2="5" />
    <line x1="3" y1="19" x2="5" y2="21" />
  </svg>
);

const ShapeRecognitionToggle = ({ app }: { app: App }) => {
  const enabled = app.state.shapeRecognitionEnabled;

  return (
    <div className="ShapeRecognitionToggle" title={t("labels.shapeRecognition")}>
      <ToolButton
        type="button"
        icon={<WandIcon />}
        aria-label={t("labels.shapeRecognition")}
        className={enabled ? "active" : ""}
        onClick={() =>
          app.setState((s) => ({
            shapeRecognitionEnabled: !s.shapeRecognitionEnabled,
            pendingShapeRecognition: null,
          }))
        }
      />
    </div>
  );
};

export default ShapeRecognitionToggle;
