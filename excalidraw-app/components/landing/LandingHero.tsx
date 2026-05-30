import React from "react";

type LandingHeroProps = {
  onScrollToCanvas: () => void;
};

export const LandingHero = ({ onScrollToCanvas }: LandingHeroProps) => (
  <section
    className="lp-hero"
    aria-labelledby="landing-title"
    data-lp-hero-parallax
  >
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

      <div className="hero-parallax" aria-hidden="true">
        <div className="hero-parallax__wrapper">
          <div className="hero-parallax__layer hero-parallax__layer--account">
            <span className="lp-topology__label">aws account</span>
            <div className="hero-parallax__layer hero-parallax__layer--region">
              <span className="lp-topology__label">region</span>
              <div className="hero-parallax__layer hero-parallax__layer--vpc">
                <span className="lp-topology__label">vpc</span>
                <span className="lp-service lp-service--igw">igw</span>
                <span className="lp-link lp-link--a" />
                <span className="lp-service lp-service--alb">alb</span>
                <span className="lp-link lp-link--b" />
                <span className="lp-service lp-service--lambda">lambda</span>
                <span className="lp-link lp-link--c" />
                <span className="lp-service lp-service--s3">s3</span>
                <span className="lp-link lp-link--d" />
                <span className="lp-service lp-service--sqs">sqs</span>
                <span className="lp-link lp-link--e" />
                <span className="lp-service lp-service--nat">nat</span>
              </div>
            </div>
          </div>
          <span className="lp-topology-note lp-topology-note--top">
            semantic view
          </span>
          <span className="lp-topology-note lp-topology-note--bottom">
            allplanmodules.json
          </span>
        </div>
      </div>
    </div>
  </section>
);
