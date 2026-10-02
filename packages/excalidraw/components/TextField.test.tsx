import { fireEvent, render, screen } from "@testing-library/react";

import { t } from "../i18n";

import { TextField } from "./TextField";

describe("TextField", () => {
  it("should expose a localized accessible label for the redaction toggle", () => {
    render(<TextField value="super-secret" isRedacted />);

    const input = screen.getByDisplayValue("super-secret");
    const revealButton = screen.getByRole("button", {
      name: t("buttons.showRedactedValue"),
    });

    expect(input).toHaveClass("is-redacted");
    expect(revealButton).toHaveAttribute("aria-pressed", "false");
    expect(revealButton).toHaveAttribute(
      "title",
      t("buttons.showRedactedValue"),
    );

    fireEvent.click(revealButton);

    const hideButton = screen.getByRole("button", {
      name: t("buttons.hideRedactedValue"),
    });

    expect(input).not.toHaveClass("is-redacted");
    expect(hideButton).toHaveAttribute("aria-pressed", "true");
    expect(hideButton).toHaveAttribute("title", t("buttons.hideRedactedValue"));
  });
});
