import React, { useCallback, useEffect, useRef } from "react";

import { TFDRAW_GITHUB_REPO_URL } from "../../app_constants";

type LandingNavProps = {
  onScrollToCanvas: () => void;
};

const NAV_LINKS = [
  { href: "#terraform-canvas", label: "Terraform canvas" },
  { href: "#workflow", label: "Workflow" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#faq", label: "FAQ" },
] as const;

export const LandingNav = ({ onScrollToCanvas }: LandingNavProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const closeDrawer = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const openDrawer = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  const handleAnchorClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (href === "#terraform-canvas") {
        event.preventDefault();
        closeDrawer();
        onScrollToCanvas();
        return;
      }
      closeDrawer();
    },
    [closeDrawer, onScrollToCanvas],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleCancel = (event: Event) => {
      event.preventDefault();
      dialog.close();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, []);

  return (
    <header className="lp-nav-wrap">
      <nav className="lp-nav" aria-label="tfdraw.dev">
        <a className="lp-nav__brand" href="#top">
          <img
            className="lp-nav__logo"
            src="/tfdraw-logo.png"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            width={512}
            height={512}
          />
          <span>tfdraw.dev</span>
        </a>

        <div className="lp-nav__links lp-nav__links--desktop">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={(event) => handleAnchorClick(event, href)}
            >
              {label}
            </a>
          ))}
          <a
            href={TFDRAW_GITHUB_REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <a href="/demo">Full editor</a>
          <button
            type="button"
            className="lp-btn lp-btn--primary lp-btn--sm"
            onClick={onScrollToCanvas}
          >
            View changes
          </button>
        </div>

        <button
          type="button"
          className="lp-nav__menu-btn"
          aria-label="Open menu"
          aria-haspopup="dialog"
          onClick={openDrawer}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </nav>

      <dialog ref={dialogRef} className="lp-nav-drawer" aria-label="Site menu">
        <div className="lp-nav-drawer__panel">
          <button
            type="button"
            className="lp-nav-drawer__close"
            aria-label="Close menu"
            onClick={closeDrawer}
          >
            ×
          </button>
          <nav className="lp-nav-drawer__links" aria-label="Mobile navigation">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={(event) => handleAnchorClick(event, href)}
              >
                {label}
              </a>
            ))}
            <a
              href={TFDRAW_GITHUB_REPO_URL}
              rel="noopener noreferrer"
              target="_blank"
              onClick={closeDrawer}
            >
              GitHub
            </a>
            <a href="/demo" onClick={closeDrawer}>
              Full editor
            </a>
            <button
              type="button"
              className="lp-btn lp-btn--primary"
              onClick={() => {
                closeDrawer();
                onScrollToCanvas();
              }}
            >
              View changes
            </button>
          </nav>
        </div>
      </dialog>
    </header>
  );
};
