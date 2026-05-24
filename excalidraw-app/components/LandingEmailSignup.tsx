import React from "react";

import { EmailSignupForm } from "./EmailSignupForm";

export const LandingEmailSignup = () => (
  <section
    className="landing-email-signup"
    aria-labelledby="landing-email-signup-title"
  >
    <div className="landing-email-signup__inner">
      <header className="landing-email-signup__header">
        <p className="landing-email-signup__eyebrow">Newsletter</p>
        <h2 id="landing-email-signup-title" className="landing-email-signup__title">
          Stay in the loop
        </h2>
        <p className="landing-email-signup__lede">
          Optional product updates for tfdraw.dev. We never receive your
          Terraform files — only your email if you choose to subscribe.
        </p>
      </header>
      <div className="landing-email-signup__card">
        <EmailSignupForm
          source="landing"
          showFieldLabel={false}
          className="tfdraw-email-signup tfdraw-email-signup--landing"
        />
      </div>
    </div>
  </section>
);
