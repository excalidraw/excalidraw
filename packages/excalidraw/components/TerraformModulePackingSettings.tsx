import React from "react";

import {
  DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS,
  MODULE_PACKING_MODE_OPTIONS,
  paramFieldsForMode,
  type ModulePackingMode,
  type ModulePackingParamField,
  type TerraformModuleLayoutOptions,
} from "./terraformModuleLayoutOptions";

type ParamGroup = ModulePackingParamField["group"];

const updateParam = <G extends ParamGroup>(
  options: TerraformModuleLayoutOptions,
  group: G,
  key: string,
  value: unknown,
): TerraformModuleLayoutOptions => ({
  ...options,
  [group]: {
    ...options[group],
    [key]: value,
  },
});

export const TerraformModulePackingSettings = ({
  options,
  onChange,
}: {
  options: TerraformModuleLayoutOptions;
  onChange: (next: TerraformModuleLayoutOptions) => void;
}) => {
  const fields = paramFieldsForMode(options.mode);

  const handleModeChange = (mode: ModulePackingMode) => {
    onChange({ ...options, mode });
  };

  const handleFieldChange = (field: ModulePackingParamField, raw: string) => {
    const group = field.group;
    let value: unknown = raw;
    if (field.type === "number") {
      const parsed = Number(raw);
      value = Number.isFinite(parsed) ? parsed : 0;
    } else if (field.type === "boolean") {
      value = raw === "true";
    }
    onChange(updateParam(options, group, field.key, value));
  };

  const handleResetDefaults = () => {
    onChange({
      ...options,
      defaultGrid: { ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.defaultGrid },
      box: { ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.box },
      rectpacking: { ...DEFAULT_TERRAFORM_MODULE_LAYOUT_OPTIONS.rectpacking },
    });
  };

  return (
    <div
      className="TerraformImportModal__modulePacking"
      data-testid="terraform-module-packing-settings"
    >
      <h5>Module packing</h5>
      <div
        className="TerraformImportModal__viewSelector__options TerraformImportModal__modulePacking__modes"
        role="radiogroup"
        aria-label="Module packing mode"
      >
        {MODULE_PACKING_MODE_OPTIONS.map((option) => {
          const checked = options.mode === option.value;
          return (
            <label
              key={option.value}
              className={`TerraformImportModal__viewSelector__option${
                checked
                  ? " TerraformImportModal__viewSelector__option--checked"
                  : ""
              }`}
            >
              <input
                type="radio"
                name="terraform-module-packing"
                value={option.value}
                checked={checked}
                onChange={() => handleModeChange(option.value)}
              />
              <span className="TerraformImportModal__viewSelector__label">
                {option.label}
              </span>
              <span className="TerraformImportModal__viewSelector__description">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>

      <div className="TerraformImportModal__modulePacking__params">
        <div className="TerraformImportModal__modulePacking__paramsHeader">
          <span className="TerraformImportModal__modulePacking__paramsTitle">
            Parameters
          </span>
          <button
            type="button"
            className="TerraformImportModal__modulePacking__reset"
            onClick={handleResetDefaults}
          >
            Reset defaults
          </button>
        </div>
        <div className="TerraformImportModal__modulePacking__paramGrid">
          {fields.map((field) => {
            const groupValue = options[field.group] as Record<string, unknown>;
            const current = groupValue[field.key];
            const inputId = `tf-module-packing-${options.mode}-${field.key}`;

            if (field.type === "boolean") {
              return (
                <label
                  key={field.key}
                  className="TerraformImportModal__modulePacking__param TerraformImportModal__modulePacking__param--checkbox"
                  htmlFor={inputId}
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    checked={Boolean(current)}
                    onChange={(event) =>
                      handleFieldChange(
                        field,
                        event.target.checked ? "true" : "false",
                      )
                    }
                  />
                  <span>{field.label}</span>
                  {field.hint ? (
                    <span className="TerraformImportModal__modulePacking__hint">
                      {field.hint}
                    </span>
                  ) : null}
                </label>
              );
            }

            if (field.type === "select" && field.options) {
              return (
                <label
                  key={field.key}
                  className="TerraformImportModal__modulePacking__param"
                  htmlFor={inputId}
                >
                  <span>{field.label}</span>
                  <select
                    id={inputId}
                    value={String(current ?? "")}
                    onChange={(event) =>
                      handleFieldChange(field, event.target.value)
                    }
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {field.hint ? (
                    <span className="TerraformImportModal__modulePacking__hint">
                      {field.hint}
                    </span>
                  ) : null}
                </label>
              );
            }

            return (
              <label
                key={field.key}
                className="TerraformImportModal__modulePacking__param"
                htmlFor={inputId}
              >
                <span>{field.label}</span>
                <input
                  id={inputId}
                  type="number"
                  value={typeof current === "number" ? current : 0}
                  min={field.min}
                  max={field.max}
                  step={field.step ?? 1}
                  onChange={(event) =>
                    handleFieldChange(field, event.target.value)
                  }
                />
                {field.hint ? (
                  <span className="TerraformImportModal__modulePacking__hint">
                    {field.hint}
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

TerraformModulePackingSettings.displayName = "TerraformModulePackingSettings";
