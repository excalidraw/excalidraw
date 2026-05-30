import React from "react";

import { LandingSectionHeading } from "../LandingSectionHeading";

const USE_CASES = [
  "Plan reviews",
  "Drift investigations",
  "Architecture reviews",
  "Change approvals",
] as const;

export const LandingUseCases = () => (
  <section
    id="use-cases"
    className="lp-use-cases lp-section--defer"
    aria-labelledby="use-cases-title"
  >
    <LandingSectionHeading
      eyebrow="Use cases"
      title="Review the real infrastructure model together."
      titleId="use-cases-title"
    />
    <div className="lp-pill-row lp-pill-row--center" data-lp-reveal>
      {USE_CASES.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  </section>
);
