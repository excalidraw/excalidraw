import React from "react";

import { EmailSignupForm } from "./EmailSignupForm";

export const LandingEmailSignup = () => (
  <section
    className="landing-email-signup"
    aria-labelledby="landing-email-signup-title"
  >
    <h2 id="landing-email-signup-title" className="landing-email-signup__title">
      Stay in the loop
    </h2>
    <p className="landing-email-signup__lede">
      Optional updates about tfdraw.dev — no Terraform files are sent.
    </p>
    <EmailSignupForm source="landing" />
  </section>
);
