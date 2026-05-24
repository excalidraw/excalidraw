import React from "react";

import { EmailSignupForm } from "./EmailSignupForm";

export const POST_IMPORT_EMAIL_DISMISSED_KEY =
  "tfdraw-post-import-email-dismissed";

/** Delay after a successful Terraform import before showing the email popup. */
export const POST_IMPORT_EMAIL_DELAY_MS = 30_000;

export const PostImportEmailPrompt = ({ onClose }: { onClose: () => void }) => {
  const dismiss = () => {
    try {
      sessionStorage.setItem(POST_IMPORT_EMAIL_DISMISSED_KEY, "1");
    } catch {
      // ignore quota / private mode
    }
    onClose();
  };

  return (
    <div
      className="tfdraw-post-import-prompt"
      role="dialog"
      aria-labelledby="tfdraw-post-import-prompt-title"
      aria-modal="true"
    >
      <div className="tfdraw-post-import-prompt__panel">
        <button
          type="button"
          className="tfdraw-post-import-prompt__close"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
        <h2 id="tfdraw-post-import-prompt-title">
          Enjoying the Terraform canvas?
        </h2>
        <p>
          Get occasional product updates when you are ready. Your import stayed
          in the browser — we only store your email if you subscribe.
        </p>
        <EmailSignupForm source="post_import" onSubmitted={dismiss} />
        <button
          type="button"
          className="tfdraw-post-import-prompt__skip"
          onClick={dismiss}
        >
          Not now
        </button>
      </div>
    </div>
  );
};
