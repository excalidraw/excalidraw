import React, { useEffect, useRef, useState } from "react";

import { LANDING_CANVAS_SECTION_ID } from "./landingScrollUtils";

const CANVAS_INSTRUCTIONS = [
  {
    step: "1. Save a plan",
    code: "terraform plan -out=tfplan.bin",
  },
  {
    step: "2. Export plan JSON",
    code: "terraform show -json tfplan.bin > tfplan.json",
  },
  {
    step: "3. Export state JSON",
    code: "terraform show -json > tfstate.json",
  },
  {
    step: "4. Export graph DOT",
    code: "terraform graph -plan=tfplan.bin > graph.dot",
  },
  {
    step: "5. Redact before upload",
    code: `jq 'walk(if type == "object" and .sensitive == true then .value = "[redacted]" else . end)' tfplan.json > tfplan.redacted.json`,
  },
] as const;

type LandingCanvasSectionProps = {
  onFrontendSceneReady?: () => void;
  renderCanvas: (onReady: () => void) => React.ReactNode;
  forceMount?: boolean;
};

export const LandingCanvasSection = ({
  onFrontendSceneReady,
  renderCanvas,
  forceMount = false,
}: LandingCanvasSectionProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [shouldMountEditor, setShouldMountEditor] = useState(forceMount);

  useEffect(() => {
    if (forceMount) {
      setShouldMountEditor(true);
    }
  }, [forceMount]);

  useEffect(() => {
    if (shouldMountEditor) {
      return;
    }

    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMountEditor(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [shouldMountEditor]);

  const handleReady = () => {
    onFrontendSceneReady?.();
  };

  return (
    <section
      ref={sectionRef}
      id={LANDING_CANVAS_SECTION_ID}
      className="lp-canvas-section lp-section--defer lp-section--defer-canvas"
      aria-labelledby="terraform-canvas-heading"
    >
      <div className="lp-canvas-section__header" data-lp-reveal>
        <p className="lp-section-heading__eyebrow">Live architecture view</p>
        <h2 id="terraform-canvas-heading" className="lp-section-heading__title">
          See what is built. See what will change.
        </h2>
      </div>

      <div
        className="lp-canvas-instructions"
        aria-label="Terraform input instructions"
        data-lp-reveal
      >
        {CANVAS_INSTRUCTIONS.map(({ step, code }) => (
          <article key={step} className="lp-canvas-instructions__card">
            <strong>{step}</strong>
            <code>{code}</code>
          </article>
        ))}
      </div>

      <div className="lp-canvas-shell">
        {shouldMountEditor ? (
          renderCanvas(handleReady)
        ) : (
          <div className="lp-canvas-shell__placeholder" aria-hidden="true">
            <div className="lp-canvas-shell__skeleton" />
            <p>Scroll to load the interactive canvas…</p>
          </div>
        )}
      </div>
    </section>
  );
};
