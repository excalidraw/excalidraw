import React from "react";
import { t } from "../i18n";
import { useExcalidrawContainer } from "./App";

interface SectionProps extends React.HTMLProps<HTMLElement> {
  heading: string;
  children?: any;
}

export const Section = ({ heading, children, ...props }: SectionProps) => {
  const { id } = useExcalidrawContainer();
  const header = (
    <h2 className="visually-hidden" id={`${id}-${heading}-title`}>
      {t(`headings.${heading}`)}
    </h2>
  );
  return (
    <section {...props} aria-labelledby={`${id}-${heading}-title`}>
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
