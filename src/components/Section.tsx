import React from "react";
import { t } from "../i18n";
import { useExcalidrawContainer } from "./App";

export const Section: React.FC<{
  heading: string;
  children?: React.ReactNode | ((heading: React.ReactNode) => React.ReactNode);
  className?: string;
}> = ({ heading, children, ...props }) => {
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
