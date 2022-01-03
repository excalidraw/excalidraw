import ReactDOM from "react-dom";
import { render } from "./test-utils";
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

const { h } = window;

const mouse = new Pointer("mouse");

beforeEach(async () => {
  // Unmount ReactDOM from root
  ReactDOM.unmountComponentAtNode(document.getElementById("root")!);
  mouse.reset();

  await setLanguage(defaultLang);
  await render(<App />);
});

it("changes text search to active on cmd+f", () => {
  h.app.actionManager.executeAction(actionToggleTextSearch);
  expect(h.state.textSearchActive).toEqual(true);
});
