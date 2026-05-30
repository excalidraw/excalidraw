import React from "react";

export const LandingStrip = () => (
  <section
    className="lp-strip lp-section--defer lp-section--defer-strip"
    aria-labelledby="landing-strip-title"
    data-lp-reveal
  >
    <h2 id="landing-strip-title" className="lp-strip__title">
      Source-backed view for platform teams
    </h2>
    <p className="lp-strip__lede">
      Turn Terraform state, plans, and reviews into one architecture canvas your
      team can read together.
    </p>
    <div className="lp-pill-row">
      <span>Terraform state</span>
      <span>Plan semantics</span>
      <span>Dependency impact</span>
      <span>Hosted review ready</span>
    </div>
  </section>
);
