import React from "react";

import {
  TFDRAW_GITHUB_REPO_URL,
  TFDRAW_GITHUB_USER_URL,
} from "../../../app_constants";

export const LandingFooter = () => (
  <footer className="lp-footer" aria-label="Project links">
    <p className="lp-footer__primary">
      <a
        href={TFDRAW_GITHUB_REPO_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        Source on GitHub
      </a>
      <span aria-hidden="true"> · </span>
      <a
        href={`${TFDRAW_GITHUB_REPO_URL}#readme`}
        rel="noopener noreferrer"
        target="_blank"
      >
        README &amp; docs
      </a>
      <span aria-hidden="true"> · </span>
      <a
        href={`${TFDRAW_GITHUB_REPO_URL}/blob/master/LICENSE`}
        rel="noopener noreferrer"
        target="_blank"
      >
        MIT license
      </a>
    </p>
    <p className="lp-footer__credit">
      Open-source Excalidraw fork by{" "}
      <a
        href={TFDRAW_GITHUB_USER_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        Tushar Sariya
      </a>{" "}
      (
      <a
        href={TFDRAW_GITHUB_REPO_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        TusharSariya/excalidraw-tf
      </a>
      )
    </p>
  </footer>
);
