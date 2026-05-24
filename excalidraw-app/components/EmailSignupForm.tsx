import React, { useCallback, useEffect, useId, useRef, useState } from "react";

import { TFDRAW_GITHUB_REPO_URL } from "../app_constants";
import { postSubscribe, type TfdrawSubscribeSource } from "../data/tfdrawApi";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";

const loadTurnstileScript = (): Promise<void> => {
  if (window.turnstile) {
    return Promise.resolve();
  }
  const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
};

export const EmailSignupForm = ({
  source,
  className,
  onSubmitted,
}: {
  source: TfdrawSubscribeSource;
  className?: string;
  onSubmitted?: () => void;
}) => {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const consentId = useId();
  const emailId = useId();
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileToken = useRef<string | null>(null);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey || !turnstileRef.current) {
      return;
    }
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !turnstileRef.current || !window.turnstile) {
          return;
        }
        turnstileWidgetId.current = window.turnstile.render(
          turnstileRef.current,
          {
            sitekey: siteKey,
            callback: (token) => {
              turnstileToken.current = token;
            },
            "expired-callback": () => {
              turnstileToken.current = null;
            },
          },
        );
      })
      .catch(() => {
        // Subscribe still works server-side when Turnstile secret is unset.
      });
    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!consent) {
        setStatus("error");
        setMessage("Please agree to receive occasional product updates.");
        return;
      }
      setStatus("loading");
      setMessage(null);
      const result = await postSubscribe(
        email,
        source,
        turnstileToken.current ?? undefined,
      );
      if (!result?.ok) {
        setStatus("error");
        setMessage(
          import.meta.env.VITE_TFDRAW_TELEMETRY_ENABLED === "true"
            ? "Could not save your email. Try again later."
            : "Email signup is disabled in this build.",
        );
        return;
      }
      setStatus("success");
      setMessage(
        result.duplicate
          ? "You are already on the list. Thanks!"
          : "Thanks — we will be in touch.",
      );
      setEmail("");
      if (siteKey && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId.current ?? undefined);
        turnstileToken.current = null;
      }
      onSubmitted?.();
    },
    [consent, email, onSubmitted, siteKey, source],
  );

  return (
    <form
      className={className ?? "tfdraw-email-signup"}
      onSubmit={handleSubmit}
    >
      <label className="tfdraw-email-signup__label" htmlFor={emailId}>
        Email for product updates
      </label>
      <div className="tfdraw-email-signup__row">
        <input
          id={emailId}
          className="tfdraw-email-signup__input"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={status === "loading"}
        />
        <button
          type="submit"
          className="tfdraw-email-signup__submit"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending…" : "Subscribe"}
        </button>
      </div>
      <label className="tfdraw-email-signup__consent">
        <input
          id={consentId}
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={status === "loading"}
        />
        I agree to receive occasional tfdraw.dev product updates.
      </label>
      {siteKey ? (
        <div ref={turnstileRef} className="tfdraw-email-signup__turnstile" />
      ) : null}
      <p className="tfdraw-email-signup__privacy">
        Terraform plans are not uploaded. See our{" "}
        <a
          href={`${TFDRAW_GITHUB_REPO_URL}/blob/master/docs/privacy.md`}
          target="_blank"
          rel="noopener noreferrer"
        >
          privacy note
        </a>
        .
      </p>
      {message ? (
        <p
          className={
            status === "error"
              ? "tfdraw-email-signup__message tfdraw-email-signup__message--error"
              : "tfdraw-email-signup__message"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
};
