import React from "react";

import { LandingSectionHeading } from "../LandingSectionHeading";

const FAQ_ITEMS = [
  {
    question: "How do I visualize a Terraform plan in tfdraw.dev?",
    answer: (
      <>
        Save a binary plan with <code>terraform plan -out=tfplan.bin</code>,
        export JSON with <code>terraform show -json tfplan.bin</code>,
        optionally export matching state and graph files, redact secrets, then
        import the files into the on-page canvas.
      </>
    ),
  },
  {
    question: "Does tfdraw.dev replace Terraform or HCL?",
    answer: (
      <>
        No. It is a read-and-annotate view on top of Terraform outputs. You keep
        HCL, modules, and workflows in Git; the canvas reflects what state and
        plans say is true in the environment.
      </>
    ),
  },
  {
    question: "What files does the canvas use?",
    answer: (
      <>
        Typical imports include Terraform state JSON, plan JSON, and a DOT graph
        from <code>terraform graph</code>. Exact formats can evolve; the
        instructions above the canvas list the current export steps.
      </>
    ),
  },
  {
    question: "Can I share a diagram with my team?",
    answer: (
      <>
        The product supports collaboration and shareable review flows so
        multiple people can inspect the same architecture view. Use the in-app
        sharing options when you are in the full editor experience.
      </>
    ),
  },
  {
    question: "Is my Terraform data uploaded to a server?",
    answer: (
      <>
        Plan JSON, graph DOT, and state files are parsed in your browser and are
        not sent to tfdraw.dev for import. Optional email signup stores only
        your address and how you signed up. Anonymous counters record import
        success or failure (no file contents). Redact secrets before sharing
        exports; follow your org data policy for collaboration features.
      </>
    ),
  },
] as const;

export const LandingFaq = () => (
  <section
    id="faq"
    className="lp-faq lp-section--defer"
    aria-labelledby="faq-title"
  >
    <LandingSectionHeading
      eyebrow="FAQ"
      title="Terraform visualization questions"
      titleId="faq-title"
    />
    <div className="lp-faq__list">
      {FAQ_ITEMS.map(({ question, answer }, index) => (
        <details
          key={question}
          className="lp-faq__item"
          data-lp-reveal
          style={{ "--lp-stagger": index } as React.CSSProperties}
        >
          <summary>{question}</summary>
          <div className="lp-faq__answer">{answer}</div>
        </details>
      ))}
    </div>
  </section>
);
