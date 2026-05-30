import React from "react";

import { LandingSectionHeading } from "../LandingSectionHeading";

const FEATURES = [
  {
    num: "01",
    title: "The diagram is the source-backed view",
    body: "There is no separate architecture diagram to keep in sync with what Terraform actually manages.",
  },
  {
    num: "02",
    title: "Plan semantics at a glance",
    body: "Replace Terraform plan noise with visual architecture changes your team can scan and discuss.",
  },
  {
    num: "03",
    title: "Ready for shared reviews",
    body: "Hosted review mode can synchronize the actual built and changing view for multiple users.",
  },
] as const;

export const LandingFeatures = () => (
  <section
    className="lp-features lp-section--defer lp-section--defer-features"
    aria-labelledby="features-title"
  >
    <LandingSectionHeading
      eyebrow="Product"
      title="Why teams use tfdraw.dev"
      titleId="features-title"
      light
    />
    <div className="lp-features__grid">
      {FEATURES.map(({ num, title, body }, index) => (
        <article
          key={num}
          data-lp-reveal
          style={{ "--lp-stagger": index } as React.CSSProperties}
        >
          <span className="lp-features__num">{num}</span>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>
      ))}
    </div>
  </section>
);
