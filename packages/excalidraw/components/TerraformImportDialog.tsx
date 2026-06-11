/**
 * Modal to upload plan JSON + graph DOT bundles (optional raw state, optional .tfd),
 * or raw Terraform state alone, and replace the canvas with the locally generated scene.
 */
import React from "react";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { TerraformModulePackingSettings } from "./TerraformModulePackingSettings";
import { useTerraformImportDialog } from "./useTerraformImportDialog";
import {
  joinPresetPath,
  MAX_PLAN_BUNDLES,
  VIEW_OPTIONS,
} from "./terraformImportDialogUtils";

import "./TerraformImportDialog.scss";

import type { TerraformImportArtifactKind } from "./terraformImportPresetsTypes";

/** Exported for tests; dialog shell is {@link TerraformImportDialog}. */
export const TerraformImportModal = ({
  onCloseRequest,
  onImportSuccess,
  onImportFail,
}: {
  onCloseRequest: () => void;
  onImportSuccess?: () => void;
  onImportFail?: () => void;
}) => {
  const {
    bundles,
    stateFiles,
    tfdFiles,
    view,
    pipelineCompact,
    pipelineLayoutVariant,
    pipelinePacked,
    moduleLayoutOptions,
    loading,
    layoutProgress,
    error,
    importWarnings,
    importDone,
    selectedPresetId,
    presetWarnings,
    availablePresets,
    presetsLoading,
    activePreset,
    artifacts,
    artifactsLoading,
    artifactRepoName,
    artifactRelativePath,
    artifactKind,
    selectedPreset,
    canImport,
    canUseSemanticView,
    semanticViewDisabled,
    usingPresetManifest,
    stateOnly,
    setStateFiles,
    setTfdFiles,
    setView,
    setPipelineCompact,
    setPipelineLayoutVariant,
    setPipelinePacked,
    setModuleLayoutOptions,
    setSelectedPresetId,
    setArtifactRepoName,
    setArtifactRelativePath,
    setArtifactKind,
    setArtifactUploadFile,
    updateBundle,
    addBundle,
    removeBundle,
    handleImport,
    handleLoadPresetAndImport,
    handleSaveAsPreset,
    handleUpdatePreset,
    handleDeletePreset,
    handleUsePresetManifest,
    handleClearPresetManifest,
    handleSyncPresetFromDisk,
    handleChoosePresetFolder,
    handleRegisterArtifact,
    handleSaveComposition,
  } = useTerraformImportDialog({
    onCloseRequest,
    onImportSuccess,
    onImportFail,
  });

  return (
    <div className="TerraformImportModal">
      <h3>Import Terraform</h3>

      <details className="TerraformImportModal__instructions">
        <summary className="TerraformImportModal__instructionsSummary">
          How to generate import files
        </summary>
        <div className="TerraformImportModal__instructionsBody">
          <p className="TerraformImportModal__instructionsLead">
            From each Terraform or OpenTofu working directory, export plan JSON
            and graph DOT as a pair. Add optional state files to enrich nodes,
            or import state alone. Attach one or more <code>.tfd</code> files
            for declared dataflow across the merged diagram.
          </p>
          <ol className="TerraformImportModal__instructionsSteps">
            <li>
              <strong>Plan JSON</strong> (required with graph DOT per stack)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`terraform plan -out=tfplan
terraform show -json tfplan > plan.json`}</code>
              </pre>
            </li>
            <li>
              <strong>Graph DOT</strong> (required with plan JSON per stack)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`terraform graph -type=plan > graph.dot`}</code>
              </pre>
            </li>
            <li>
              <strong>State JSON</strong> (optional, multiple allowed)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`terraform state pull > state.json`}</code>
              </pre>
            </li>
            <li>
              <strong>Dataflow links</strong> (optional, multiple{" "}
              <code>.tfd</code>)
              <pre className="TerraformImportModal__instructionsCode">
                <code>{`bind writer = module.foo.aws_lambda_function.this[0]
writer -> bucket`}</code>
              </pre>
            </li>
          </ol>
          <p className="TerraformImportModal__instructionsFoot">
            Duplicate resource addresses across imports: last file wins (see
            warnings after import). Cross-stack imports work best when module
            paths do not collide.
          </p>
        </div>
      </details>

      <div className="TerraformImportModal__section">
        <h4>Presets</h4>
        <label>
          Preset
          <select
            value={selectedPresetId}
            disabled={presetsLoading || loading}
            onChange={(event) => setSelectedPresetId(event.target.value)}
          >
            {availablePresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
                {preset.builtin ? " (built-in)" : ""}
              </option>
            ))}
          </select>
        </label>
        {selectedPreset && (
          <div className="TerraformImportModal__presetSummary">
            <div>
              <strong>Stacks:</strong> {selectedPreset.stacks.length}
            </div>
            <div>
              <strong>TFD files:</strong> {selectedPreset.tfdPaths.length}
            </div>
            <div>
              <strong>View:</strong> {selectedPreset.view}
            </div>
            <div>
              <strong>Root:</strong> {selectedPreset.rootPath}
            </div>
            <div>
              <strong>Content:</strong>{" "}
              {selectedPreset.hasContent
                ? "stored in SQLite (portable)"
                : "paths only — sync from disk"}
            </div>
          </div>
        )}
        {presetsLoading && (
          <p className="TerraformImportModal__muted">
            Loading presets from SQLite…
          </p>
        )}
        <div className="TerraformImportModal__presetButtons">
          <button
            type="button"
            onClick={handleLoadPresetAndImport}
            disabled={loading || !selectedPreset}
          >
            Load & import
          </button>
          <button
            type="button"
            onClick={handleUsePresetManifest}
            disabled={loading || !selectedPreset}
          >
            Use preset manifest
          </button>
          {activePreset && (
            <button
              type="button"
              onClick={handleClearPresetManifest}
              disabled={loading}
            >
              Clear preset manifest
            </button>
          )}
          <button type="button" onClick={handleSaveAsPreset} disabled={loading}>
            Save as new
          </button>
          <button
            type="button"
            onClick={handleUpdatePreset}
            disabled={loading || !selectedPreset || selectedPreset.builtin}
          >
            Update selected
          </button>
          <button
            type="button"
            onClick={handleDeletePreset}
            disabled={loading || !selectedPreset || selectedPreset.builtin}
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={handleSyncPresetFromDisk}
            disabled={loading || !selectedPreset}
          >
            Sync from disk
          </button>
          <button
            type="button"
            onClick={handleChoosePresetFolder}
            disabled={loading}
          >
            Choose preset folder
          </button>
        </div>
      </div>

      {import.meta.env.DEV && (
        <div className="TerraformImportModal__section">
          <h4>Artifact library</h4>
          <p className="TerraformImportModal__muted">
            Register plan/dot/state blobs under{" "}
            <code>repoName/relativePath</code> for TFD <code>use</code> blocks.
          </p>
          <div className="TerraformImportModal__artifactForm">
            <label>
              Repo name
              <input
                value={artifactRepoName}
                disabled={loading}
                onChange={(event) => setArtifactRepoName(event.target.value)}
              />
            </label>
            <label>
              Relative path
              <input
                value={artifactRelativePath}
                placeholder="my-stack/plan.json"
                disabled={loading}
                onChange={(event) =>
                  setArtifactRelativePath(event.target.value)
                }
              />
            </label>
            <label>
              Kind
              <select
                value={artifactKind}
                disabled={loading}
                onChange={(event) =>
                  setArtifactKind(
                    event.target.value as TerraformImportArtifactKind,
                  )
                }
              >
                <option value="plan">plan</option>
                <option value="dot">dot</option>
                <option value="state">state</option>
              </select>
            </label>
            <label>
              File
              <input
                type="file"
                disabled={loading}
                onChange={(event) =>
                  setArtifactUploadFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleRegisterArtifact()}
            >
              Register artifact
            </button>
            <button
              type="button"
              disabled={loading || tfdFiles.length === 0}
              onClick={() => void handleSaveComposition()}
            >
              Save composition
            </button>
          </div>
          {artifactsLoading ? (
            <p className="TerraformImportModal__muted">Loading artifacts…</p>
          ) : artifacts.length > 0 ? (
            <ul className="TerraformImportModal__artifactList">
              {artifacts.slice(0, 12).map((artifact) => (
                <li key={`${artifact.repoName}/${artifact.relativePath}`}>
                  <code>
                    {artifact.repoName}/{artifact.relativePath}
                  </code>{" "}
                  ({artifact.kind})
                </li>
              ))}
            </ul>
          ) : (
            <p className="TerraformImportModal__muted">
              No artifacts registered yet.
            </p>
          )}
        </div>
      )}

      {usingPresetManifest && activePreset ? (
        <div className="TerraformImportModal__section">
          <h4>Preset manifest</h4>
          <p className="TerraformImportModal__muted">
            Files are loaded from the preset database (plan, graph, state, and
            .tfd content). Use <strong>Load &amp; import</strong> or{" "}
            <strong>Import &amp; Open</strong> below. Copy{" "}
            <code>terraform-import-presets.db</code> to move presets between
            machines.
          </p>
          <div className="TerraformImportModal__presetManifest">
            <table>
              <thead>
                <tr>
                  <th>Stack</th>
                  <th>Plan</th>
                  <th>Graph</th>
                  <th>State (optional)</th>
                </tr>
              </thead>
              <tbody>
                {activePreset.stacks.map((stack) => (
                  <tr key={stack.id}>
                    <td>{stack.label}</td>
                    <td>
                      <code>
                        {joinPresetPath(activePreset.rootPath, stack.planPath)}
                      </code>
                    </td>
                    <td>
                      <code>
                        {joinPresetPath(activePreset.rootPath, stack.dotPath)}
                      </code>
                    </td>
                    <td>
                      {stack.statePath ? (
                        <code>
                          {joinPresetPath(
                            activePreset.rootPath,
                            stack.statePath,
                          )}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {activePreset.tfdPaths.length > 0 && (
              <ul className="TerraformImportModal__fileList">
                {activePreset.tfdPaths.map((tfdPath) => (
                  <li key={tfdPath}>
                    <code>
                      {joinPresetPath(activePreset.rootPath, tfdPath)}
                    </code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="TerraformImportModal__section">
            <h4>Plan + graph bundles</h4>
            <p className="TerraformImportModal__muted">
              One row per Terraform root or workspace ({MAX_PLAN_BUNDLES} max).
            </p>
            <div className="TerraformImportModal__bundles">
              {bundles.map((row, index) => (
                <div key={row.id} className="TerraformImportModal__bundle">
                  <div className="TerraformImportModal__bundleHeader">
                    <span className="TerraformImportModal__bundleTitle">
                      Stack {index + 1}
                    </span>
                    {bundles.length > 1 && (
                      <button
                        type="button"
                        className="TerraformImportModal__bundleRemove"
                        onClick={() => removeBundle(row.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <label>
                    Label (optional)
                    <input
                      type="text"
                      placeholder="e.g. networking"
                      value={row.label}
                      onChange={(e) =>
                        updateBundle(row.id, { label: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Plan file (.json)
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) =>
                        updateBundle(row.id, {
                          planFile: e.target.files?.[0] ?? null,
                        })
                      }
                    />
                  </label>
                  <label>
                    Graph file (.dot)
                    <input
                      type="file"
                      accept=".dot"
                      onChange={(e) =>
                        updateBundle(row.id, {
                          dotFile: e.target.files?.[0] ?? null,
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="TerraformImportModal__addBundle"
              disabled={bundles.length >= MAX_PLAN_BUNDLES}
              onClick={addBundle}
            >
              Add plan + graph
            </button>
          </div>

          <div className="TerraformImportModal__section">
            <h4>State files</h4>
            <label>
              State (.tfstate / state pull JSON)
              <span className="TerraformImportModal__muted">
                Optional with plan bundles to enrich nodes; or select one or
                more alone for module or semantic views.
              </span>
              <input
                type="file"
                multiple
                accept=".tfstate,.json"
                onChange={(e) =>
                  setStateFiles(Array.from(e.target.files ?? []))
                }
              />
            </label>
            {stateFiles.length > 0 && (
              <ul className="TerraformImportModal__fileList">
                {stateFiles.map((f) => (
                  <li key={`${f.name}-${f.size}`}>{f.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="TerraformImportModal__section">
            <h4>Dataflow links</h4>
            <label htmlFor="terraform-import-links">
              <span className="TerraformImportModal__muted">
                Optional arrow-only overlay; edges are applied in file order
                across all selected <code>.tfd</code> files.
              </span>
              <input
                id="terraform-import-links"
                type="file"
                multiple
                accept=".tfd,.txt"
                onChange={(e) => setTfdFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            {tfdFiles.length > 0 && (
              <ul className="TerraformImportModal__fileList">
                {tfdFiles.map((f) => (
                  <li key={`${f.name}-${f.size}`}>{f.name}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="TerraformImportModal__divider" />

      <div
        className="TerraformImportModal__section TerraformImportModal__viewSelector"
        role="radiogroup"
        aria-label="View options"
      >
        <h4>View options</h4>
        <div className="TerraformImportModal__viewSelector__options">
          {VIEW_OPTIONS.map((option) => {
            const checked = view === option.value;
            const disabled =
              (option.value === "semantic" || option.value === "pipeline") &&
              semanticViewDisabled;
            return (
              <label
                key={option.value}
                className={`TerraformImportModal__viewSelector__option${
                  checked
                    ? " TerraformImportModal__viewSelector__option--checked"
                    : ""
                }${
                  disabled
                    ? " TerraformImportModal__viewSelector__option--disabled"
                    : ""
                }`}
                title={
                  option.value === "semantic" && !canUseSemanticView
                    ? "Semantic view requires at least one plan+graph pair or a state file."
                    : option.value === "pipeline" && !canUseSemanticView
                    ? "Pipeline view requires at least one plan+graph pair or a state file."
                    : option.value === "semantic" && stateOnly
                    ? "Shows current infrastructure from state (no planned changes)."
                    : undefined
                }
              >
                <input
                  type="radio"
                  name="terraform-view"
                  value={option.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => setView(option.value)}
                />
                <span className="TerraformImportModal__viewSelector__label">
                  {option.label}
                </span>
                <span className="TerraformImportModal__viewSelector__description">
                  {option.description}
                </span>
                {option.value === "pipeline" && checked && !disabled && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <div
                      className="TerraformImportModal__viewSubOptionRow"
                      role="group"
                      aria-label="Pipeline detail level"
                    >
                      <span className="TerraformImportModal__viewSubOptionLabel">
                        Detail
                      </span>
                      <div className="TerraformImportModal__viewSubOption">
                        <button
                          type="button"
                          className={`TerraformImportModal__viewSubOption__btn${
                            pipelineCompact
                              ? " TerraformImportModal__viewSubOption__btn--active"
                              : ""
                          }`}
                          aria-pressed={pipelineCompact}
                          onClick={() => setPipelineCompact(true)}
                        >
                          Compact
                        </button>
                        <button
                          type="button"
                          className={`TerraformImportModal__viewSubOption__btn${
                            !pipelineCompact
                              ? " TerraformImportModal__viewSubOption__btn--active"
                              : ""
                          }`}
                          aria-pressed={!pipelineCompact}
                          onClick={() => setPipelineCompact(false)}
                        >
                          Full
                        </button>
                      </div>
                    </div>
                    <div
                      className="TerraformImportModal__viewSubOptionRow"
                      role="group"
                      aria-label="Pipeline layout variant"
                    >
                      <span className="TerraformImportModal__viewSubOptionLabel">
                        Layout
                      </span>
                      <div className="TerraformImportModal__viewSubOption">
                        <button
                          type="button"
                          className={`TerraformImportModal__viewSubOption__btn${
                            pipelineLayoutVariant === "classic"
                              ? " TerraformImportModal__viewSubOption__btn--active"
                              : ""
                          }`}
                          aria-pressed={pipelineLayoutVariant === "classic"}
                          onClick={() => setPipelineLayoutVariant("classic")}
                        >
                          Classic
                        </button>
                        <button
                          type="button"
                          className={`TerraformImportModal__viewSubOption__btn${
                            pipelineLayoutVariant === "compound"
                              ? " TerraformImportModal__viewSubOption__btn--active"
                              : ""
                          }`}
                          aria-pressed={pipelineLayoutVariant === "compound"}
                          onClick={() => setPipelineLayoutVariant("compound")}
                        >
                          Compound
                        </button>
                      </div>
                    </div>
                    <div
                      className="TerraformImportModal__viewSubOptionRow"
                      role="group"
                      aria-label="Pipeline height packing"
                    >
                      <span className="TerraformImportModal__viewSubOptionLabel">
                        Height
                      </span>
                      <div className="TerraformImportModal__viewSubOption">
                        <button
                          type="button"
                          className={`TerraformImportModal__viewSubOption__btn${
                            !pipelinePacked
                              ? " TerraformImportModal__viewSubOption__btn--active"
                              : ""
                          }`}
                          aria-pressed={!pipelinePacked}
                          onClick={() => setPipelinePacked(false)}
                        >
                          Stacked
                        </button>
                        <button
                          type="button"
                          className={`TerraformImportModal__viewSubOption__btn${
                            pipelinePacked
                              ? " TerraformImportModal__viewSubOption__btn--active"
                              : ""
                          }`}
                          aria-pressed={pipelinePacked}
                          title="Push receive-only groups into later columns and pack boxes side by side to reduce diagram height"
                          onClick={() => setPipelinePacked(true)}
                        >
                          Packed
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {view === "module" ? (
        <TerraformModulePackingSettings
          options={moduleLayoutOptions}
          onChange={setModuleLayoutOptions}
        />
      ) : null}

      <div className="TerraformImportModal__settings__buttons">
        {importDone ? (
          <FilledButton onClick={onCloseRequest}>Done</FilledButton>
        ) : (
          <FilledButton onClick={handleImport} disabled={!canImport || loading}>
            {loading
              ? layoutProgress
                ? `Importing… ${layoutProgress}`
                : "Importing..."
              : "Import & Open"}
          </FilledButton>
        )}
      </div>

      {error && <div className="TerraformImportModal__error">{error}</div>}

      {importWarnings && importWarnings.length > 0 && (
        <details className="TerraformImportModal__warnings" open>
          <summary>Import warnings ({importWarnings.length})</summary>
          <ul>
            {importWarnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
        </details>
      )}
      {presetWarnings.length > 0 && (
        <details className="TerraformImportModal__warnings" open>
          <summary>Preset warnings ({presetWarnings.length})</summary>
          <ul>
            {presetWarnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

/** Dialog shell around `TerraformImportModal` (wide layout, no default title chrome). */
export const TerraformImportDialog = ({
  onCloseRequest,
  onImportSuccess,
  onImportFail,
}: {
  onCloseRequest: () => void;
  onImportSuccess?: () => void;
  onImportFail?: () => void;
}) => {
  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <TerraformImportModal
        onCloseRequest={onCloseRequest}
        onImportSuccess={onImportSuccess}
        onImportFail={onImportFail}
      />
    </Dialog>
  );
};
