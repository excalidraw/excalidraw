import { ExcalidrawImperativeAPI } from "../../../types";
import { MIME_TYPES } from "../entry";
import { Button } from "../../../components/Button";

const COMMENT_SVG = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-message-circle"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
  </svg>
);
const CustomFooter = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  return (
    <>
      <Button
        onSelect={() => alert("General Kenobi!")}
        className="you are a bold one"
        style={{ marginLeft: "1rem" }}
        title="Hello there!"
      >
        {COMMENT_SVG}
      </Button>
      <button
        className="custom-element"
        onClick={() => {
          excalidrawAPI?.setActiveTool({
            type: "custom",
            customType: "comment",
          });
          const url = `data:${MIME_TYPES.svg},${encodeURIComponent(
            `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="feather feather-message-circle"
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
  </svg>`,
          )}`;
          excalidrawAPI?.setCursor(`url(${url}), auto`);
        }}
      >
        {COMMENT_SVG}
      </button>
      <button
        className="custom-footer"
        onClick={() => alert("This is dummy footer")}
      >
        custom footer
      </button>
    </>
  );
};

export default CustomFooter;
