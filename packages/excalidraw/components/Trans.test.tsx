import { render } from "@testing-library/react";

import { EditorJotaiProvider } from "../editor-jotai";
import fallbackLangData from "../locales/en.json";

import Trans from "./Trans";

import type { TranslationKeys } from "../i18n";

describe("Test <Trans/>", () => {
  it("should translate the the strings correctly", () => {
    //@ts-ignore
    fallbackLangData.transTest = {
      key1: "Hello {{audience}}",
      key2: "Please <link>click the button</link> to continue.",
      key3: "Please <link>click {{location}}</link> to continue.",
      key4: "Please <link>click <bold>{{location}}</bold></link> to continue.",
      key5: "Please <connect-link>click the button</connect-link> to continue.",
    };

    const { getByTestId } = render(
      <EditorJotaiProvider>
        <div data-testid="test1">
          <Trans
            i18nKey={"transTest.key1" as unknown as TranslationKeys}
            audience="world"
          />
        </div>
        <div data-testid="test2">
          <Trans
            i18nKey={"transTest.key2" as unknown as TranslationKeys}
            link={(el) => <a href="https://example.com">{el}</a>}
          />
        </div>
        <div data-testid="test3">
          <Trans
            i18nKey={"transTest.key3" as unknown as TranslationKeys}
            link={(el) => <a href="https://example.com">{el}</a>}
            location="the button"
          />
        </div>
        <div data-testid="test4">
          <Trans
            i18nKey={"transTest.key4" as unknown as TranslationKeys}
            link={(el) => <a href="https://example.com">{el}</a>}
            location="the button"
            bold={(el) => <strong>{el}</strong>}
          />
        </div>
        <div data-testid="test5">
          <Trans
            i18nKey={"transTest.key5" as unknown as TranslationKeys}
            connect-link={(el) => <a href="https://example.com">{el}</a>}
          />
        </div>
      </EditorJotaiProvider>,
    );

    expect(getByTestId("test1").innerHTML).toEqual("Hello world");
    expect(getByTestId("test2").innerHTML).toEqual(
      `Please <a href="https://example.com">click the button</a> to continue.`,
    );
    expect(getByTestId("test3").innerHTML).toEqual(
      `Please <a href="https://example.com">click the button</a> to continue.`,
    );
    expect(getByTestId("test4").innerHTML).toEqual(
      `Please <a href="https://example.com">click <strong>the button</strong></a> to continue.`,
    );
    expect(getByTestId("test5").innerHTML).toEqual(
      `Please <a href="https://example.com">click the button</a> to continue.`,
    );
  });
});
