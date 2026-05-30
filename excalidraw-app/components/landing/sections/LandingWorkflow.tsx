import React from "react";

import { LandingSectionHeading } from "../LandingSectionHeading";

const STEPS = [
  {
    title: "Load state and plan",
    body: "Map actual Terraform state and tfplan output into the visual model.",
  },
  {
    title: "Read the change",
    body: "See creates, deletes, replacements, and dependency impact in the architecture view.",
  },
  {
    title: "Annotate the truth",
    body: "Customize and annotate the view without forking it from the underlying infrastructure model.",
  },
] as const;

export const LandingWorkflow = () => (
  <section
    id="workflow"
    className="lp-workflow lp-section--defer"
    aria-labelledby="workflow-title"
  >
    <LandingSectionHeading
      eyebrow="Workflow"
      title="From Terraform truth to a readable canvas."
      titleId="workflow-title"
    />
    <ol className="lp-steps">
      {STEPS.map(({ title, body }, index) => (
        <li
          key={title}
          data-lp-reveal
          style={{ "--lp-stagger": index } as React.CSSProperties}
        >
          <span className="lp-steps__num">
            {String(index + 1).padStart(2, "0")}
          </span>
          <strong>{title}</strong>
          <span>{body}</span>
        </li>
      ))}
    </ol>
  </section>
);
