import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  AttributionMarkSurvey,
  type AttributionSurveyAnswers,
} from "./AttributionMarkSurvey";

// Exercises the component the same way ImageExportDialog does: parent owns
// the answers, survey only calls back up.
const Harness = () => {
  const [answers, setAnswers] = useState<AttributionSurveyAnswers>({});
  return (
    <AttributionMarkSurvey
      answers={answers}
      onAnswer={(id, answer) =>
        setAnswers((prev) => ({ ...prev, [id]: answer }))
      }
    />
  );
};

describe("AttributionMarkSurvey", () => {
  it("shows only the first question active, with its hint, and no done badge", () => {
    render(<Harness />);

    expect(screen.getByText("Why are you turning it off?")).toBeTruthy();
    expect(screen.getByText("(pick one, fill if other)")).toBeTruthy();
    expect(screen.queryByText("✓ done")).toBeNull();
    // later questions aren't shown yet
    expect(screen.queryByText("What is this export for?")).toBeNull();
  });

  it("collapses an answered question and hides its hint, revealing the next one", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByText("It clashes with my design or looks unprofessional"),
    );

    // q1 is now collapsed: done badge + answer shown, hint gone
    expect(screen.getByText("✓ done")).toBeTruthy();
    expect(
      screen.getByText("It clashes with my design or looks unprofessional"),
    ).toBeTruthy();
    expect(screen.queryByText("(pick one, fill if other)")).toBeTruthy(); // now on q2
    expect(screen.getByText("What is this export for?")).toBeTruthy();
  });

  it("reveals an inline text field only after clicking Other, and submits on Enter", () => {
    render(<Harness />);

    expect(screen.queryByPlaceholderText("Tell us more")).toBeNull();

    fireEvent.click(screen.getByText("Other"));
    const input = screen.getByPlaceholderText("Tell us more");
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { value: "My custom reason" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("My custom reason")).toBeTruthy();
    expect(screen.getByText("What is this export for?")).toBeTruthy();
  });

  it("does not offer an Other option on the third question", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByText("It clashes with my design or looks unprofessional"),
    );
    fireEvent.click(screen.getByText("GitHub PR, README or docs"));

    expect(screen.getByText("What would make you keep it on?")).toBeTruthy();
    expect(screen.queryByText("Other")).toBeNull();
  });

  it("shows all four as collapsed summaries once complete", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByText("It clashes with my design or looks unprofessional"),
    );
    fireEvent.click(screen.getByText("GitHub PR, README or docs"));
    fireEvent.click(screen.getByText("A smaller or subtler credit"));
    fireEvent.click(screen.getByText("Developer or engineer"));

    expect(screen.getAllByText("✓ done").length).toBe(4);
    // no active options list left to interact with
    expect(screen.queryByText("(pick one, fill if other)")).toBeNull();
    expect(screen.queryByText("(pick one)")).toBeNull();
  });
});
