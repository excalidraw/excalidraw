import React, { Suspense } from "react";

const HeroTopologyScene = React.lazy(() =>
  import("./HeroTopologyScene").then((module) => ({
    default: module.HeroTopologyScene,
  })),
);

type LandingHeroProps = {
  onScrollToCanvas: () => void;
};

const HeroSceneFallback = () => (
  <div
    className="lp-hero-scene-wrap lp-hero-scene-wrap--fallback"
    aria-hidden="true"
  >
    <img
      className="lp-hero-scene__fallback-img"
      src="/og-image.png"
      alt=""
      loading="eager"
      decoding="async"
    />
  </div>
);

export const LandingHero = ({ onScrollToCanvas }: LandingHeroProps) => (
  <section className="lp-hero" aria-labelledby="landing-title">
    <div className="lp-hero__bg" aria-hidden="true" />
    <div className="lp-hero__inner">
      <div className="lp-hero__copy">
        <p className="lp-hero__eyebrow">
          Keep your architecture diagram in sync with your Terraform.
        </p>
        <h1 id="landing-title">Terraform as a living architecture diagram</h1>
        <p className="lp-hero__lede">
          tfdraw.dev maps Terraform state, tfplan JSON, and graph data into an
          editable architecture canvas so platform teams can visualize changes,
          review plans, and annotate the real infrastructure model.
        </p>
        <div className="lp-hero__actions">
          <button
            type="button"
            className="lp-btn lp-btn--primary"
            onClick={onScrollToCanvas}
          >
            Visualize a plan
          </button>
          <a href="/demo" className="lp-btn lp-btn--ghost">
            Full editor demo
          </a>
        </div>
        <div className="lp-hero__proof" aria-label="tfdraw.dev values">
          <span>State-backed architecture view</span>
          <span>Visual plan diffs</span>
          <span>Custom annotations</span>
          <span>Shareable review canvas</span>
        </div>
      </div>

      <div className="lp-hero__visual" aria-hidden="true">
        <Suspense fallback={<HeroSceneFallback />}>
          <HeroTopologyScene />
        </Suspense>
      </div>
    </div>
  </section>
);
