import React, { useState } from "react";

import { Dialog } from "./Dialog";

import { t } from "../i18n";

import "./TrustedDomainsDialog.scss";

const Header = (props: { title: string }) => {
  return (
    <div className="TrustedDomainsDialog__header">
      <p className="TrustedDomainsDialog__description">{props.title}</p>
      <p
        style={{
          fontSize: "0.75rem",
          fontStyle: "italic",
          color: "var(--color-gray-60)",
          marginBlockStart: "0.25rem",
        }}
      >
        {t("trustedDomainsDialog.sessionNote")}
      </p>
    </div>
  );
};

const Warning = (props: { warningDescription: string }) => {
  return (
    <div className="TrustedDomainsDialog__warning-container">
      <p className="TrustedDomainsDialog__warning-title">⚠️</p>
      <p className="TrustedDomainsDialog__warning-description">
        {props.warningDescription}
      </p>
    </div>
  );
};

const InputSection = (props: {
  input: {
    value: string;
    setInputValue: (value: string) => void;
  };
  handleKeyDown: (e: React.KeyboardEvent) => void;
  addDomain: (e: React.MouseEvent) => void;
  error: string;
}) => {
  return (
    <div className={"TrustedDomainsDialog__input-container"}>
      <div className={"TrustedDomainsDialog__input-row"}>
        <input
          className={`TrustedDomainsDialog__input${
            props.error ? " TrustedDomainsDialog__input--error" : ""
          }`}
          type="text"
          value={props.input.value}
          onChange={(e) => props.input.setInputValue(e.target.value)}
          onKeyDown={props.handleKeyDown}
          placeholder={t("trustedDomainsDialog.placeholder")}
        />
        <button
          className={"TrustedDomainsDialog__input_add-btn"}
          onClick={props.addDomain}
        >
          {t("trustedDomainsDialog.add")}
        </button>
      </div>
      {props.error && (
        <p className={"TrustedDomainsDialog__error"}>{props.error}</p>
      )}
    </div>
  );
};

const DomainEntry = (props: {
  domain: string;
  removeDomain: (domain: string) => void;
}) => {
  return (
    <li className={"TrustedDomainsDialog__entry"}>
      <span className={"TrustedDomainsDialog__entry_domain"}>
        {props.domain}
      </span>
      <button
        className={"TrustedDomainsDialog__entry_remove-btn"}
        onClick={() => props.removeDomain(props.domain)}
      >
        {t("trustedDomainsDialog.remove")}
      </button>
    </li>
  );
};

export const TrustedDomainsDialog = ({
  onClose,
  trustedDomains,
  onDomainsChange,
}: {
  onClose: () => void;
  trustedDomains: string[];
  onDomainsChange: (domains: string[]) => void;
}) => {
  const [inputValue, setInputValue] = useState<string>("");
  const [domains, setDomains] = useState<string[]>(trustedDomains);
  const [error, setError] = useState<string>("");

  const normalizeTrustedDomain = (input: string): string | null => {
    const trimmed = input.trim().toLowerCase().replace(/\.$/, "");

    if (!trimmed) {
      return null;
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return null;
    }

    if (/[/?#@\s]/.test(trimmed)) {
      return null;
    }

    if (trimmed.includes(":")) {
      return null;
    }

    const DOMAIN_RE =
      /^(localhost|(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63})$/i;

    return DOMAIN_RE.test(trimmed) ? trimmed : null;
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (error) {
      setError("");
    }
  };

  const addDomain = (_: React.MouseEvent | void) => {
    if (domains.length >= 10) {
      setError(t("trustedDomainsDialog.limitReached"));
      return;
    }

    const normalized = normalizeTrustedDomain(inputValue);

    if (!normalized) {
      setError(t("trustedDomainsDialog.invalidDomain"));
      return;
    }

    if (domains.includes(normalized)) {
      setError(t("trustedDomainsDialog.duplicateDomain"));
      return;
    }

    const updated = [...domains, normalized];
    setDomains(updated);
    onDomainsChange(updated);
    setInputValue("");
    setError("");
  };

  const removeDomain = (domain: string) => {
    const updated = domains.filter((d) => d !== domain);
    setDomains(updated);
    onDomainsChange(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addDomain();
    }
  };

  return (
    <Dialog
      onCloseRequest={onClose}
      title={t("trustedDomainsDialog.title")}
      size={"small"}
      className={"TrustedDomainsDialog"}
    >
      <div className={"TrustedDomainsDialog__content"}>
        <Header title={t("trustedDomainsDialog.description")}></Header>
        <Warning
          warningDescription={t("trustedDomainsDialog.warningDescription")}
        />
        <InputSection
          input={{ value: inputValue, setInputValue: handleInputChange }}
          handleKeyDown={handleKeyDown}
          addDomain={addDomain}
          error={error}
        />
        {domains.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {domains.map((domain) => (
              <DomainEntry
                domain={domain}
                removeDomain={removeDomain}
                key={domain}
              />
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: "0.875rem", color: "var(--color-gray-60)" }}>
            {t("trustedDomainsDialog.empty")}
          </p>
        )}
      </div>
    </Dialog>
  );
};
