import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { LandingEmailSignup } from "../LandingEmailSignup";

import "../../landing.scss";

import { LandingCanvasSection } from "./LandingCanvasSection";
import { LandingHero } from "./LandingHero";
import { LandingNav } from "./LandingNav";
import { initLandingScrollRevealFallback } from "./landingScrollEffects";
import {
  scrollToLandingCanvasSection,
  scrollToLandingTop,
} from "./landingScrollUtils";
import { LandingFaq } from "./sections/LandingFaq";
import { LandingFeatures } from "./sections/LandingFeatures";
import { LandingFinal } from "./sections/LandingFinal";
import { LandingFooter } from "./sections/LandingFooter";
import { LandingStrip } from "./sections/LandingStrip";
import { LandingUseCases } from "./sections/LandingUseCases";
import { LandingWorkflow } from "./sections/LandingWorkflow";

type LandingPageProps = {
  renderCanvas: (onReady: () => void) => React.ReactNode;
};

export const LandingPage = ({ renderCanvas }: LandingPageProps) => {
  const pageRef = useRef<HTMLElement>(null);
  const landingScrollRestorationRef = useRef<ScrollRestoration | null>(null);
  const landingScrollCleanupRef = useRef<(() => void) | null>(null);
  const [forceMountCanvas, setForceMountCanvas] = useState(false);

  const scrollToCanvas = useCallback((behavior: ScrollBehavior = "smooth") => {
    setForceMountCanvas(true);
    scrollToLandingCanvasSection(behavior);
  }, []);

  const scheduleLandingTopScroll = useCallback(() => {
    landingScrollCleanupRef.current?.();

    if (window.location.hash) {
      return;
    }

    const scroll = () => scrollToLandingTop("auto");
    scroll();

    const rafId = requestAnimationFrame(() => {
      scroll();
      requestAnimationFrame(scroll);
    });
    const timeoutIds = [50, 150, 400, 800, 1500].map((delay) =>
      window.setTimeout(scroll, delay),
    );

    landingScrollCleanupRef.current = () => {
      cancelAnimationFrame(rafId);
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const handleFrontendSceneReady = useCallback(() => {
    scheduleLandingTopScroll();
  }, [scheduleLandingTopScroll]);

  useLayoutEffect(() => {
    document.documentElement.classList.add("terraform-canvas-landing");
    document.body.classList.add("terraform-canvas-landing");

    landingScrollRestorationRef.current = history.scrollRestoration;
    history.scrollRestoration = "manual";

    scheduleLandingTopScroll();

    return () => {
      landingScrollCleanupRef.current?.();
      landingScrollCleanupRef.current = null;
      document.documentElement.classList.remove("terraform-canvas-landing");
      document.body.classList.remove("terraform-canvas-landing");
      if (landingScrollRestorationRef.current) {
        history.scrollRestoration = landingScrollRestorationRef.current;
      }
    };
  }, [scheduleLandingTopScroll]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) {
      return;
    }
    return initLandingScrollRevealFallback(root);
  }, []);

  return (
    <main id="top" className="landing-page" ref={pageRef}>
      <LandingNav onScrollToCanvas={() => scrollToCanvas()} />
      <LandingHero onScrollToCanvas={() => scrollToCanvas()} />
      <LandingCanvasSection
        forceMount={forceMountCanvas}
        onFrontendSceneReady={handleFrontendSceneReady}
        renderCanvas={renderCanvas}
      />
      <LandingStrip />
      <LandingWorkflow />
      <LandingFeatures />
      <LandingUseCases />
      <LandingFaq />
      <LandingFinal onScrollToCanvas={() => scrollToCanvas()} />
      <LandingEmailSignup />
      <LandingFooter />
    </main>
  );
};
