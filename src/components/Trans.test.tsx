import { render } from "@testing-library/react";

import fallbackLangData from "../locales/en.json";

import Trans from "./Trans";

describe("Trans", () => {
  it("should translate", () => {
    (fallbackLangData as any).transtest = {
      key1: "Hello {{audience}}",
      key2: "Please {{connectLinkStart}}click the button{{connectLinkEnd}} to continue.",
      key3: "Please {{connectLinkStart}}click {{location}}{{connectLinkEnd}} to continue.",
      key4: "Please {{connectLinkStart}}click {{boldStart}}{{location}}{{boldEnd}}{{connectLinkEnd}} to continue.",
    };

    const { getByTestId } = render(
      <>
        <div data-testid="test1">
          <Trans i18nKey="transtest.key1" audience="world" />
        </div>
        <div data-testid="test2">
          <Trans
            i18nKey="transtest.key2"
            connectLink={(el: any) => <a href="https://example.com">{el}</a>}
          />
        </div>
        <div data-testid="test3">
          <Trans
            i18nKey="transtest.key3"
            connectLink={(el: any) => <a href="https://example.com">{el}</a>}
            location="the button"
          />
        </div>
        <div data-testid="test4">
          <Trans
            i18nKey="transtest.key4"
            connectLink={(el: any) => <a href="https://example.com">{el}</a>}
            location="the button"
            bold={(el: any) => <strong>{el}</strong>}
          />
        </div>
      </>,
    );

    expect(getByTestId("test1").innerHTML).toEqual(`Hello world`);
    expect(getByTestId("test2").innerHTML).toEqual(
      `Please <a href="https://example.com">click the button</a> to continue.`,
    );
    expect(getByTestId("test3").innerHTML).toEqual(
      `Please <a href="https://example.com">click the button</a> to continue.`,
    );
    expect(getByTestId("test4").innerHTML).toEqual(
      `Please <a href="https://example.com">click <strong>the button</strong></a> to continue.`,
    );
  });
});
