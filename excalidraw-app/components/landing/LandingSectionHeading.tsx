import React from "react";

type LandingSectionHeadingProps = {
  eyebrow: string;
  title: string;
  titleId: string;
  light?: boolean;
};

export const LandingSectionHeading = ({
  eyebrow,
  title,
  titleId,
  light = false,
}: LandingSectionHeadingProps) => (
  <div
    className={`lp-section-heading${light ? " lp-section-heading--light" : ""}`}
    data-lp-reveal
  >
    <p className="lp-section-heading__eyebrow">{eyebrow}</p>
    <h2 id={titleId} className="lp-section-heading__title">
      {title}
    </h2>
  </div>
);
