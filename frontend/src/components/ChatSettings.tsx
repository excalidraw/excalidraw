import { useEffect, useState } from "react";

import RoughBox from "@/components/RoughBox";
import RoughLine from "@/components/RoughLine";
import { FIELD_OPTIONS, NARROW_QUERY, SELECTION_OPTIONS } from "@/config";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { ChatSettingsValues, SettingsSection } from "@/types";

interface ChatSettingsProps {
  values: ChatSettingsValues;
  onChange: (values: ChatSettingsValues) => void;
  open: boolean;
  onClose: () => void;
}

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "models", label: "Models" },
  { id: "save-location", label: "Save Location" },
  { id: "system-instructions", label: "System Instructions" },
  { id: "data-sources", label: "Data Sources" },
];

const MODELS = ["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"];

const SAVE_LOCATIONS = [
  { id: "browser", label: "This browser" },
  { id: "folder", label: "Local folder" },
  { id: "cloud", label: "Cloud sync" },
];

/** Row that wears the crosshatch sketch box while it is the selected one. */
function SelectableRow({
  label,
  selected,
  onSelect,
  onRemove,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="settings__row">
      {selected && <RoughBox className="settings__row-mark" options={SELECTION_OPTIONS} />}
      <button className="settings__row-label" type="button" onClick={onSelect}>
        {label}
      </button>
      {onRemove && (
        <button
          className="settings__row-remove"
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

/** Sketch-framed list whose rows are separated by hand-drawn rules. */
function ListBox({ count, children }: { count: number; children: React.ReactNode }) {
  const dividers = Array.from({ length: Math.max(count - 1, 0) }, (_, index) => (index + 1) / count);

  return (
    <div className="settings__list">
      <RoughBox dividers={dividers} />
      <div className="settings__list-rows">{children}</div>
    </div>
  );
}

export function ChatSettings({ values, onChange, open, onClose }: ChatSettingsProps) {
  const [section, setSection] = useState<SettingsSection>("models");
  const narrow = useMediaQuery(NARROW_QUERY);
  const [draftSource, setDraftSource] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const update = <K extends keyof ChatSettingsValues>(
    key: K,
    value: ChatSettingsValues[K],
  ) => {
    onChange({ ...values, [key]: value });
  };

  const addDataSource = () => {
    const source = draftSource.trim();
    if (source === "" || values.dataSources.includes(source)) {
      return;
    }

    update("dataSources", [...values.dataSources, source]);
    setDraftSource("");
  };

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <section
        className="settings"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <RoughBox className="settings__frame" />

        <nav className="settings__nav">
          {SECTIONS.map(({ id, label }) => (
            <SelectableRow
              key={id}
              label={label}
              selected={section === id}
              onSelect={() => setSection(id)}
            />
          ))}
        </nav>

        <div className="settings__rule">
          <RoughLine orientation={narrow ? "horizontal" : "vertical"} />
        </div>

        <div className="settings__pane">
          {section === "models" && (
            <>
              <div className="settings__field settings__field--inline">
                <span className="settings__label">Choose the Model</span>
                <div className="settings__control settings__control--select">
                  <RoughBox options={FIELD_OPTIONS} />
                  <select
                    value={values.model}
                    onChange={(event) => update("model", event.target.value)}
                  >
                    {MODELS.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="settings__field">
                <span className="settings__label">Enter the API key</span>
                <div className="settings__control">
                  <RoughBox options={FIELD_OPTIONS} />
                  <input
                    type="password"
                    value={values.apiKey}
                    placeholder="sk-…"
                    onChange={(event) => update("apiKey", event.target.value)}
                  />
                </div>
              </div>

              <div className="settings__field">
                <span className="settings__label">Saved Models</span>
                <ListBox count={values.savedModels.length}>
                  {values.savedModels.map((model) => (
                    <SelectableRow
                      key={model}
                      label={model}
                      selected={values.model === model}
                      onSelect={() => update("model", model)}
                    />
                  ))}
                </ListBox>
              </div>
            </>
          )}

          {section === "save-location" && (
            <div className="settings__field">
              <span className="settings__label">Where chats are stored</span>
              <ListBox count={SAVE_LOCATIONS.length}>
                {SAVE_LOCATIONS.map(({ id, label }) => (
                  <SelectableRow
                    key={id}
                    label={label}
                    selected={values.saveLocation === id}
                    onSelect={() => update("saveLocation", id)}
                  />
                ))}
              </ListBox>
            </div>
          )}

          {section === "system-instructions" && (
            <>
              <div className="settings__field">
                <span className="settings__label">System prompt</span>
                <div className="settings__control settings__control--area">
                  <RoughBox options={FIELD_OPTIONS} />
                  <textarea
                    rows={8}
                    value={values.systemPrompt}
                    placeholder="Tell the model how to behave…"
                    onChange={(event) => update("systemPrompt", event.target.value)}
                  />
                </div>
              </div>

              <div className="settings__field settings__field--inline">
                <span className="settings__label">
                  Temperature: {values.temperature.toFixed(1)}
                </span>
                <input
                  className="settings__slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={values.temperature}
                  onChange={(event) => update("temperature", Number(event.target.value))}
                />
              </div>
            </>
          )}

          {section === "data-sources" && (
            <>
              <div className="settings__field">
                <span className="settings__label">Add a data source</span>
                <div className="settings__control">
                  <RoughBox options={FIELD_OPTIONS} />
                  <input
                    type="text"
                    value={draftSource}
                    placeholder="https://… or a folder path"
                    onChange={(event) => setDraftSource(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addDataSource();
                      }
                    }}
                  />
                </div>
              </div>

              {values.dataSources.length > 0 && (
                <div className="settings__field">
                  <span className="settings__label">Connected</span>
                  <ListBox count={values.dataSources.length}>
                    {values.dataSources.map((source) => (
                      <SelectableRow
                        key={source}
                        label={source}
                        selected={false}
                        onSelect={() => undefined}
                        onRemove={() =>
                          update(
                            "dataSources",
                            values.dataSources.filter((item) => item !== source),
                          )
                        }
                      />
                    ))}
                  </ListBox>
                </div>
              )}
            </>
          )}
        </div>

        <button
          className="settings__close"
          type="button"
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </section>
    </div>
  );
}

export default ChatSettings;
