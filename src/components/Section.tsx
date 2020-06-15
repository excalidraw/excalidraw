import React from "react";
import { t } from "../i18n";

interface SectionProps extends React.HTMLProps<HTMLElement> {
  heading: string;
  children: React.ReactNode | ((header: React.ReactNode) => React.ReactNode);
}

export const Section = ({ heading, children, ...props }: SectionProps) => {
  const header = (
    <h2 className="visually-hidden" id={`${heading}-title`}>
      {t(`headings.${heading}`)}
    </h2>
  );
  return (
    <section {...props} aria-labelledby={`${heading}-title`}>
      {typeof children === "function" ? (
        children(header)
      ) : (
        <>
          {header}
          {children}
        </>
      )}
    </section>
  );
};
