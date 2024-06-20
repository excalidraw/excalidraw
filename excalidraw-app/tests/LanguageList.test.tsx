import { i18branches } from "../../packages/excalidraw/utils";
import { UI } from "../../packages/excalidraw/tests/helpers/ui";
import {
  TEST_LANG_CODE,
  defaultLang,
  setLanguage
} from "../../packages/excalidraw/i18n";
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

  it("displays the test right-to-left language correctly", async () => {
    await render(<ExcalidrawApp />);

    UI.clickTool("rectangle");
    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    // set language to a test one that is right-to-left
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: `${TEST_LANG_CODE}.rtl` },
    });

    // check if language was correctly set to right-to-left:
    expect(document.documentElement.dir).toBe("rtl");

    // reset language
    fireEvent.change(document.querySelector(".dropdown-select__language")!, {
      target: { value: defaultLang.code },
    });

    // check if language direction reset correctly:
    await waitFor(() => expect(document.documentElement.dir).toBe("ltr"));
  })

  it("falls back to English when a non-supported language is set", async () => {
    await render(<ExcalidrawApp />);

    UI.clickTool("rectangle");
    fireEvent.click(document.querySelector(".dropdown-menu-button")!);

    // set invalid language
    setLanguage({ code: "languagethatdoesnotexist" });

    // even though the language is technically "invalidcode", make sure the
    // actual text becomes english. Because there is no 'getLanguageData' function,
    // this is most reasonable way with the resources we have.
    await waitFor(() => expect(
      document.querySelector(".dropdown-select__language").getAttribute("aria-label")
    ).toBe("Select language"));
  })
});

afterAll(() => {
  const branchCount = Object.keys(i18branches).length;
  const takenBranchCount = Object.values(i18branches).filter(branch => branch).length;
  const branchPercent = (takenBranchCount / branchCount) * 100;

  console.log('Branches taken for i18n.ts: ', i18branches);
  console.log(`\nBranch percentage: ${branchPercent.toFixed(2)}%`);
});
