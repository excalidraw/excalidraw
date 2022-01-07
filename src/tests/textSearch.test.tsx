import ReactDOM from "react-dom";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { render, fireEvent } from "./test-utils";
import App from "../components/App";
import { defaultLang, setLanguage } from "../i18n";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { UI, Pointer, Keyboard } from "./helpers/ui";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { API } from "./helpers/api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { KEYS } from "../keys";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CODES } from "../keys";
import { actionToggleTextSearch } from "../actions";
import { centerScrollOn } from "../scene/scroll";

const { h } = window;

const mouse = new Pointer("mouse");

beforeEach(async () => {
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
  mouse.reset();
  await setLanguage(defaultLang);
  await render(<App />);
});

it("changes text search to active on toggle text search", () => {
  h.app.actionManager.executeAction(actionToggleTextSearch);
  expect(h.state.textSearchActive).toEqual(true);
});

it("changes text search to false after pressing escape", () => {
  h.app.setState({ textSearchActive: true });
  Keyboard.keyPress(KEYS.ESCAPE);
  expect(h.state.textSearchActive).toEqual(false);
});

it("centers canvas on matched element", () => {
  h.app.setState({ textSearchActive: true, searchMatchText: "test" });
  const text = API.createElement({
    type: "text",
    text: "test",
    x: 60,
    y: 0,
    width: 100,
    height: 100,
  });
  h.elements = [text];
  Keyboard.keyPress(KEYS.ENTER);
  const testNewCenter = centerScrollOn({
    scenePoint: {
      x: text.x,
      y: text.y,
    },
    viewportDimensions: {
      width: h.state.width,
      height: h.state.height,
    },
    zoom: h.state.zoom,
  });
  expect(testNewCenter.scrollX).toEqual(h.state.scrollX);
  expect(testNewCenter.scrollY).toEqual(h.state.scrollY);
});

it("centers on second matched element after pressing enter twice", () => {
  h.app.setState({ textSearchActive: true, searchMatchText: "test" });
  const textOne = API.createElement({
    type: "text",
    text: "test",
    x: 60,
    y: 0,
    width: 100,
    height: 100,
  });
  const textTwo = API.createElement({
    type: "text",
    text: "test",
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  });
  h.elements = [textOne, textTwo];
  Keyboard.keyPress(KEYS.ENTER);
  Keyboard.keyPress(KEYS.ENTER);
  const testNewCenter = centerScrollOn({
    scenePoint: {
      x: textTwo.x,
      y: textTwo.y,
    },
    viewportDimensions: {
      width: h.state.width,
      height: h.state.height,
    },
    zoom: h.state.zoom,
  });
  expect(testNewCenter.scrollX).toEqual(h.state.scrollX);
  expect(testNewCenter.scrollY).toEqual(h.state.scrollY);
});
