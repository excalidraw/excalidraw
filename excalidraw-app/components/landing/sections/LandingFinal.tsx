import React from "react";

type LandingFinalProps = {
  onScrollToCanvas: () => void;
};

export const LandingFinal = ({ onScrollToCanvas }: LandingFinalProps) => (
  <section
    className="lp-final lp-section--defer"
    aria-labelledby="final-title"
    data-lp-reveal
  >
    <h2 id="final-title">Bring the next Terraform review to tfdraw.dev.</h2>
    <button
      type="button"
      className="lp-btn lp-btn--primary lp-btn--lg"
      onClick={onScrollToCanvas}
    >
      Visualize Terraform changes
    </button>
  </section>
);
