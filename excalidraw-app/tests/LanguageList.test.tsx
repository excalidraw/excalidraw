import { defaultLang } from "../../packages/excalidraw/i18n";
import { i18branches } from "../../packages/excalidraw/utils";
import { UI } from "../../packages/excalidraw/tests/helpers/ui";
import {
  screen,
  fireEvent,
  waitFor,
  render,
} from "../../packages/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";

describe("Test LanguageList", () => {
  it("rerenders UI on language change", async () => {
    await render(<ExcalidrawApp />);

    // select rectangle tool to show properties menu
    UI.clickTool("rectangle");
    // english lang should display `thin` label
    expect(screen.queryByTitle(/thin/i)).not.toBeNull();
    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: "de-DE" },
    });
    // switching to german, `thin` label should no longer exist
    await waitFor(() => expect(screen.queryByTitle(/thin/i)).toBeNull());
    // reset language
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: defaultLang.code },
    });
    // switching back to English
    await waitFor(() => expect(screen.queryByTitle(/thin/i)).not.toBeNull());
  });
});

afterAll(() => {
  const branchCount = Object.keys(i18branches).length;
  const takenBranchCount = Object.values(i18branches).filter(branch => branch).length;
  const branchPercent = (takenBranchCount / branchCount) * 100;

  console.log('Branches taken for i18n.ts: ', i18branches);
  console.log(`\nBranch percentage: ${branchPercent.toFixed(2)}%`);
});
