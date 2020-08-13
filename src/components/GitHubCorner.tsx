import React from "react";
import oc from "open-color";

// https://github.com/tholman/github-corners
export const GitHubCorner = React.memo(() => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 250 250"
    className="github-corner rtl-mirror"
  >
    <a
      href="https://github.com/excalidraw/excalidraw"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub repository"
    >
      <path d="M0 0l115 115h15l12 27 108 108V0z" fill={oc.gray[6]} />
      <path
        className="octo-arm"
        d="M128 109c-15-9-9-19-9-19 3-7 2-11 2-11-1-7 3-2 3-2 4 5 2 11 2 11-3 10 5 15 9 16"
        style={{ transformOrigin: "130px 106px" }}
        fill={oc.white}
      />
      <path
        className="octo-body"
        d="M115 115s4 2 5 0l14-14c3-2 6-3 8-3-8-11-15-24 2-41 5-5 10-7 16-7 1-2 3-7 12-11 0 0 5 3 7 16 4 2 8 5 12 9s7 8 9 12c14 3 17 7 17 7-4 8-9 11-11 11 0 6-2 11-7 16-16 16-30 10-41 2 0 3-1 7-5 11l-12 11c-1 1 1 5 1 5z"
        fill={oc.white}
      />
    </a>
  </svg>
  // <svg width={40} height={40} fill="none" xmlns="http://www.w3.org/2000/svg">
  //   <a
  //     href="https://github.com/excalidraw/excalidraw"
  //     target="_blank"
  //     rel="noopener noreferrer"
  //     aria-label="GitHub repository"
  //   >
  //     <path d="M40 0H0l40 40V0z" fill={oc.gray[5]} />
  //     <path
  //       d="M21.97 22.071l1.954-1.955a2.407 2.407 0 00.844-1.793c1.762 1.41 4.03 2.475 6.788-.282a3.886 3.886 0 001.136-2.652 3.622 3.622 0 001.86-1.95s-.42-.772-2.723-1.227a9.558 9.558 0 00-3.536-3.536c-.454-2.303-1.227-2.722-1.227-2.722a3.622 3.622 0 00-1.95 1.859 3.886 3.886 0 00-2.667 1.151c-2.737 2.738-1.671 5.006-.282 6.789a2.405 2.405 0 00-1.778.828l-1.955 1.955m1.515-1.516c-3.283-1.767-1.262-3.788-2.02-5.05l2.02 5.05z"
  //       stroke={oc.white}
  //       strokeWidth={1.429}
  //       strokeLinecap="round"
  //       strokeLinejoin="round"
  //     />
  //   </a>
  // </svg>
));
