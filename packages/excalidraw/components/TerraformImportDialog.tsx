/**
 * Modal to upload plan JSON + graph DOT bundles (optional raw state, optional .tfd),
 * or raw Terraform state alone, and replace the canvas with the locally generated scene.
 */
import React from "react";

import { Dialog } from "./Dialog";
import { FilledButton } from "./FilledButton";
import { TerraformModulePackingSettings } from "./TerraformModulePackingSettings";
import { TerraformImportPipelineSettings } from "./TerraformImportPipelineSettings";
import { useTerraformImportDialog } from "./useTerraformImportDialog";
import {
  joinPresetPath,
  MAX_PLAN_BUNDLES,
  VIEW_OPTIONS,
} from "./terraformImportDialogUtils";

import "./TerraformImportDialog.scss";

import type { TerraformImportArtifactKind } from "./terraformImportPresetsTypes";

const FileSummary = ({ files }: { files: readonly File[] }) =>
  files.length > 0 ? (
    <ul className="TerraformImportModal__fileList" aria-label="Selected files">
      {files.map((file) => (
        <li key={`${file.name}-${file.size}`}>
          <span aria-hidden="true">✓</span>
          <span>{file.name}</span>
        </li>
      ))}
    </ul>
  ) : null;

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
  const dialog = useTerraformImportDialog({
    onCloseRequest,
    onImportSuccess,
    onImportFail,
  });
  const {
    bundles,
    stateFiles,
    tfdFiles,
    view,
    pipelineCompact,
    pipelineLayoutVariant,
    pipelinePacked,
    pipelinePackedPullLeft,
    pipelineIncludeAncillary,
    pipelineSemanticPlacement,
    pipelineSwimlaneLaneRise,
    pipelineReorder,
    pipelineDeBandLevel,
    pipelineRankSeparate,
    pipelineStraighten,
    pipelineColumnPacking,
    pipelineLayoutProfile,
    pipelineStaircaseBandOverlap,
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
    semanticViewDisabled,
    usingPresetManifest,
    stateOnly,
  } = dialog;

  const completeBundleCount = bundles.filter(
    (bundle) => bundle.planFile && bundle.dotFile,
  ).length;
  const sourceSummary = usingPresetManifest
    ? `Preset manifest · ${activePreset?.stacks.length ?? 0} stacks`
    : completeBundleCount > 0
    ? `${completeBundleCount} stack${completeBundleCount === 1 ? "" : "s"}`
    : stateFiles.length > 0
    ? `${stateFiles.length} state file${stateFiles.length === 1 ? "" : "s"}`
    : "Choose import files";
  const selectedView =
    VIEW_OPTIONS.find((option) => option.value === view)?.label ?? view;

  return (
    <div className="TerraformImportModal">
      <header className="TerraformImportModal__intro">
        <p>
          Turn Terraform plans, state, or a saved preset into an editable
          infrastructure diagram.
        </p>
        <details className="TerraformImportModal__instructions">
          <summary>Preparing import files</summary>
          <div className="TerraformImportModal__instructionsBody">
            <p>
              Export plan JSON and graph DOT as a pair from each Terraform or
              OpenTofu working directory. State and <code>.tfd</code> dataflow
              files are optional.
            </p>
            <div className="TerraformImportModal__commandGrid">
              <div>
                <strong>Plan JSON</strong>
                <pre tabIndex={0}>
                  <code>{`terraform plan -out=tfplan
terraform show -json tfplan > plan.json`}</code>
                </pre>
              </div>
              <div>
                <strong>Graph DOT</strong>
                <pre tabIndex={0}>
                  <code>terraform graph -type=plan &gt; graph.dot</code>
                </pre>
              </div>
              <div>
                <strong>State JSON</strong>
                <pre tabIndex={0}>
                  <code>terraform state pull &gt; state.json</code>
                </pre>
              </div>
              <div>
                <strong>Dataflow links</strong>
                <pre tabIndex={0}>
                  <code>writer -&gt; bucket</code>
                </pre>
              </div>
            </div>
          </div>
        </details>
      </header>

      <section
        className="TerraformImportModal__presetCard"
        aria-labelledby="terraform-preset-heading"
      >
        <div className="TerraformImportModal__sectionHeader">
          <div>
            <h3 id="terraform-preset-heading">Start from a preset</h3>
            <p>Import immediately or load its manifest to adjust the view.</p>
          </div>
          {selectedPreset?.builtin && (
            <span className="TerraformImportModal__badge">Built-in</span>
          )}
        </div>
        <div className="TerraformImportModal__presetMain">
          <label>
            <span className="TerraformImportModal__controlLabel">Preset</span>
            <select
              value={selectedPresetId}
              disabled={presetsLoading || loading}
              onChange={(event) =>
                dialog.setSelectedPresetId(event.target.value)
              }
            >
              {availablePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                  {preset.builtin ? " (built-in)" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="TerraformImportModal__presetActions">
            <FilledButton
              onClick={dialog.handleLoadPresetAndImport}
              disabled={loading || !selectedPreset}
            >
              Import preset
            </FilledButton>
            <FilledButton
              variant="outlined"
              onClick={dialog.handleUsePresetManifest}
              disabled={loading || !selectedPreset}
            >
              Edit before import
            </FilledButton>
          </div>
        </div>
        {presetsLoading ? (
          <p className="TerraformImportModal__muted">Loading presets…</p>
        ) : selectedPreset ? (
          <dl className="TerraformImportModal__presetSummary">
            <div>
              <dt>Stacks</dt>
              <dd>{selectedPreset.stacks.length}</dd>
            </div>
            <div>
              <dt>Dataflow files</dt>
              <dd>{selectedPreset.tfdPaths.length}</dd>
            </div>
            <div>
              <dt>Default view</dt>
              <dd>{selectedPreset.view}</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>{selectedPreset.hasContent ? "Portable" : "Paths only"}</dd>
            </div>
          </dl>
        ) : null}
        <details className="TerraformImportModal__advanced">
          <summary>Manage presets</summary>
          <div className="TerraformImportModal__buttonRow">
            {activePreset && (
              <button
                type="button"
                onClick={dialog.handleClearPresetManifest}
                disabled={loading}
              >
                Clear active manifest
              </button>
            )}
            <button
              type="button"
              onClick={dialog.handleSaveAsPreset}
              disabled={loading}
            >
              Save as new
            </button>
            <button
              type="button"
              onClick={dialog.handleUpdatePreset}
              disabled={loading || !selectedPreset || selectedPreset.builtin}
            >
              Update selected
            </button>
            <button
              type="button"
              onClick={dialog.handleSyncPresetFromDisk}
              disabled={loading || !selectedPreset}
            >
              Sync from disk
            </button>
            <button
              type="button"
              onClick={dialog.handleChoosePresetFolder}
              disabled={loading}
            >
              Choose preset folder
            </button>
            <button
              type="button"
              className="TerraformImportModal__dangerButton"
              onClick={dialog.handleDeletePreset}
              disabled={loading || !selectedPreset || selectedPreset.builtin}
            >
              Delete selected
            </button>
          </div>
        </details>
      </section>

      <div className="TerraformImportModal__workspace">
        <section
          className="TerraformImportModal__panel"
          aria-labelledby="terraform-sources-heading"
        >
          <div className="TerraformImportModal__sectionHeader">
            <div>
              <span className="TerraformImportModal__eyebrow">1 · Source</span>
              <h3 id="terraform-sources-heading">
                Choose infrastructure files
              </h3>
              <p>Plan + graph is recommended. State can also import alone.</p>
            </div>
          </div>

          {usingPresetManifest && activePreset ? (
            <div className="TerraformImportModal__activePreset">
              <div className="TerraformImportModal__activePresetHeader">
                <div>
                  <strong>{activePreset.name}</strong>
                  <span>
                    {activePreset.stacks.length} stacks ·{" "}
                    {activePreset.tfdPaths.length} dataflow files
                  </span>
                </div>
                <button
                  type="button"
                  onClick={dialog.handleClearPresetManifest}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>
              <details>
                <summary>Review manifest paths</summary>
                <div className="TerraformImportModal__presetManifest">
                  <table>
                    <caption>Preset stack files</caption>
                    <thead>
                      <tr>
                        <th scope="col">Stack</th>
                        <th scope="col">Plan</th>
                        <th scope="col">Graph</th>
                        <th scope="col">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePreset.stacks.map((stack) => (
                        <tr key={stack.id}>
                          <td>{stack.label}</td>
                          <td>
                            <code>
                              {joinPresetPath(
                                activePreset.rootPath,
                                stack.planPath,
                              )}
                            </code>
                          </td>
                          <td>
                            <code>
                              {joinPresetPath(
                                activePreset.rootPath,
                                stack.dotPath,
                              )}
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
                              "Optional"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          ) : (
            <>
              <div className="TerraformImportModal__bundles">
                {bundles.map((row, index) => (
                  <fieldset
                    key={row.id}
                    className="TerraformImportModal__bundle"
                  >
                    <legend>Stack {index + 1}</legend>
                    {bundles.length > 1 && (
                      <button
                        type="button"
                        className="TerraformImportModal__bundleRemove"
                        onClick={() => dialog.removeBundle(row.id)}
                      >
                        Remove stack
                      </button>
                    )}
                    <label>
                      <span className="TerraformImportModal__controlLabel">
                        Label <span>(optional)</span>
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. networking"
                        value={row.label}
                        onChange={(event) =>
                          dialog.updateBundle(row.id, {
                            label: event.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="TerraformImportModal__filePair">
                      <label className="TerraformImportModal__filePicker">
                        <span className="TerraformImportModal__controlLabel">
                          Plan file <code>.json</code>
                        </span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={(event) =>
                            dialog.updateBundle(row.id, {
                              planFile: event.target.files?.[0] ?? null,
                            })
                          }
                        />
                        <span className="TerraformImportModal__filePickerText">
                          {row.planFile?.name ?? "Choose plan JSON"}
                        </span>
                      </label>
                      <label className="TerraformImportModal__filePicker">
                        <span className="TerraformImportModal__controlLabel">
                          Graph file <code>.dot</code>
                        </span>
                        <input
                          type="file"
                          accept=".dot"
                          onChange={(event) =>
                            dialog.updateBundle(row.id, {
                              dotFile: event.target.files?.[0] ?? null,
                            })
                          }
                        />
                        <span className="TerraformImportModal__filePickerText">
                          {row.dotFile?.name ?? "Choose graph DOT"}
                        </span>
                      </label>
                    </div>
                  </fieldset>
                ))}
              </div>
              <button
                type="button"
                className="TerraformImportModal__addBundle"
                disabled={bundles.length >= MAX_PLAN_BUNDLES}
                onClick={dialog.addBundle}
              >
                + Add another stack
              </button>

              <div className="TerraformImportModal__optionalGrid">
                <div className="TerraformImportModal__optionalCard">
                  <div>
                    <strong>State files</strong>
                    <span>Enrich plans or import current infrastructure.</span>
                  </div>
                  <label className="TerraformImportModal__filePicker">
                    <span className="TerraformImportModal__controlLabel">
                      State (.tfstate / JSON)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".tfstate,.json"
                      onChange={(event) =>
                        dialog.setStateFiles(
                          Array.from(event.target.files ?? []),
                        )
                      }
                    />
                    <span className="TerraformImportModal__filePickerText">
                      Choose state files
                    </span>
                  </label>
                  <FileSummary files={stateFiles} />
                </div>
                <div className="TerraformImportModal__optionalCard">
                  <div>
                    <strong>Dataflow links</strong>
                    <span>Add declared relationships from .tfd files.</span>
                  </div>
                  <label
                    className="TerraformImportModal__filePicker"
                    htmlFor="terraform-import-links"
                  >
                    <span className="TerraformImportModal__controlLabel">
                      Dataflow (.tfd / TXT)
                    </span>
                    <input
                      id="terraform-import-links"
                      type="file"
                      multiple
                      accept=".tfd,.txt"
                      onChange={(event) =>
                        dialog.setTfdFiles(Array.from(event.target.files ?? []))
                      }
                    />
                    <span className="TerraformImportModal__filePickerText">
                      Choose dataflow files
                    </span>
                  </label>
                  <FileSummary files={tfdFiles} />
                </div>
              </div>
            </>
          )}
        </section>

        <section
          className="TerraformImportModal__panel"
          aria-labelledby="terraform-layout-heading"
        >
          <div className="TerraformImportModal__sectionHeader">
            <div>
              <span className="TerraformImportModal__eyebrow">2 · Layout</span>
              <h3 id="terraform-layout-heading">Choose a diagram view</h3>
              <p>Each view emphasizes a different infrastructure structure.</p>
            </div>
          </div>
          <div
            className="TerraformImportModal__viewSelector"
            role="radiogroup"
            aria-label="View options"
          >
            {VIEW_OPTIONS.map((option) => {
              const checked = view === option.value;
              const disabled =
                (option.value === "semantic" ||
                  option.value === "pipeline" ||
                  option.value === "rcll") &&
                semanticViewDisabled;
              const descriptionId = `terraform-view-${option.value}-description`;
              return (
                <label
                  key={option.value}
                  className={`TerraformImportModal__viewOption${
                    checked ? " TerraformImportModal__viewOption--checked" : ""
                  }${
                    disabled
                      ? " TerraformImportModal__viewOption--disabled"
                      : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="terraform-view"
                    value={option.value}
                    checked={checked}
                    disabled={disabled}
                    aria-describedby={descriptionId}
                    onChange={() => dialog.setView(option.value)}
                  />
                  <span className="TerraformImportModal__viewOptionIndicator">
                    <span />
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <span id={descriptionId}>{option.description}</span>
                    {option.value === "semantic" && stateOnly && (
                      <em>Shows current state without planned changes.</em>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {(view === "pipeline" || view === "rcll") &&
            !semanticViewDisabled && (
              <TerraformImportPipelineSettings
                pipelineCompact={pipelineCompact}
                pipelineLayoutVariant={pipelineLayoutVariant}
                pipelinePacked={pipelinePacked}
                pipelinePackedPullLeft={pipelinePackedPullLeft}
                pipelineIncludeAncillary={pipelineIncludeAncillary}
                pipelineSemanticPlacement={pipelineSemanticPlacement}
                pipelineSwimlaneLaneRise={pipelineSwimlaneLaneRise}
                pipelineReorder={pipelineReorder}
                pipelineDeBandLevel={pipelineDeBandLevel}
                pipelineRankSeparate={pipelineRankSeparate}
                pipelineStraighten={pipelineStraighten}
                pipelineColumnPacking={pipelineColumnPacking}
                pipelineLayoutProfile={pipelineLayoutProfile}
                pipelineStaircaseBandOverlap={pipelineStaircaseBandOverlap}
                setPipelineCompact={dialog.setPipelineCompact}
                setPipelineLayoutVariant={dialog.setPipelineLayoutVariant}
                setPipelinePacked={dialog.setPipelinePacked}
                setPipelinePackedPullLeft={dialog.setPipelinePackedPullLeft}
                setPipelineIncludeAncillary={dialog.setPipelineIncludeAncillary}
                setPipelineSemanticPlacement={
                  dialog.setPipelineSemanticPlacement
                }
                setPipelineSwimlaneLaneRise={
                  dialog.setPipelineSwimlaneLaneRise
                }
                setPipelineReorder={dialog.setPipelineReorder}
                setPipelineDeBandLevel={dialog.setPipelineDeBandLevel}
                setPipelineRankSeparate={dialog.setPipelineRankSeparate}
                setPipelineStraighten={dialog.setPipelineStraighten}
                setPipelineColumnPacking={dialog.setPipelineColumnPacking}
                setPipelineLayoutProfile={dialog.setPipelineLayoutProfile}
                setPipelineStaircaseBandOverlap={
                  dialog.setPipelineStaircaseBandOverlap
                }
                showPlacement={view !== "rcll"}
                showVariant={view !== "rcll"}
              />
            )}
          {view === "module" && (
            <TerraformModulePackingSettings
              options={moduleLayoutOptions}
              onChange={dialog.setModuleLayoutOptions}
            />
          )}
        </section>
      </div>

      {import.meta.env.DEV && (
        <details className="TerraformImportModal__advanced TerraformImportModal__developerTools">
          <summary>Developer tools</summary>
          <div className="TerraformImportModal__developerToolsBody">
            <p className="TerraformImportModal__muted">
              Register plan, graph, and state blobs for TFD use blocks.
            </p>
            <div className="TerraformImportModal__artifactForm">
              <label>
                <span className="TerraformImportModal__controlLabel">
                  Repo name
                </span>
                <input
                  type="text"
                  value={artifactRepoName}
                  disabled={loading}
                  onChange={(event) =>
                    dialog.setArtifactRepoName(event.target.value)
                  }
                />
              </label>
              <label>
                <span className="TerraformImportModal__controlLabel">
                  Relative path
                </span>
                <input
                  type="text"
                  value={artifactRelativePath}
                  placeholder="my-stack/plan.json"
                  disabled={loading}
                  onChange={(event) =>
                    dialog.setArtifactRelativePath(event.target.value)
                  }
                />
              </label>
              <label>
                <span className="TerraformImportModal__controlLabel">Kind</span>
                <select
                  value={artifactKind}
                  disabled={loading}
                  onChange={(event) =>
                    dialog.setArtifactKind(
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
                <span className="TerraformImportModal__controlLabel">File</span>
                <input
                  type="file"
                  disabled={loading}
                  onChange={(event) =>
                    dialog.setArtifactUploadFile(
                      event.target.files?.[0] ?? null,
                    )
                  }
                />
              </label>
            </div>
            <div className="TerraformImportModal__buttonRow">
              <button
                type="button"
                disabled={loading}
                onClick={() => void dialog.handleRegisterArtifact()}
              >
                Register artifact
              </button>
              <button
                type="button"
                disabled={loading || tfdFiles.length === 0}
                onClick={() => void dialog.handleSaveComposition()}
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
        </details>
      )}

      <div className="TerraformImportModal__messages">
        {error && (
          <div className="TerraformImportModal__error" role="alert">
            <strong>Import could not start</strong>
            <span>{error}</span>
          </div>
        )}
        {importWarnings && importWarnings.length > 0 && (
          <details className="TerraformImportModal__warnings" open>
            <summary>Import warnings ({importWarnings.length})</summary>
            <ul>
              {importWarnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>{warning.message}</li>
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

      <footer className="TerraformImportModal__footer">
        <div className="TerraformImportModal__footerSummary" aria-live="polite">
          <strong>{sourceSummary}</strong>
          <span>{selectedView}</span>
        </div>
        {importDone ? (
          <FilledButton onClick={onCloseRequest}>Done</FilledButton>
        ) : (
          <FilledButton
            size="large"
            onClick={dialog.handleImport}
            disabled={!canImport || loading}
          >
            {loading
              ? layoutProgress
                ? `Importing… ${layoutProgress}`
                : "Importing…"
              : "Import & Open"}
          </FilledButton>
        )}
      </footer>
    </div>
  );
};

/** Dialog shell around `TerraformImportModal` (wide layout). */
export const TerraformImportDialog = ({
  onCloseRequest,
  onImportSuccess,
  onImportFail,
}: {
  onCloseRequest: () => void;
  onImportSuccess?: () => void;
  onImportFail?: () => void;
}) => (
  <Dialog
    className="TerraformImportDialog"
    onCloseRequest={onCloseRequest}
    size="wide"
    title="Import Terraform"
  >
    <TerraformImportModal
      onCloseRequest={onCloseRequest}
      onImportSuccess={onImportSuccess}
      onImportFail={onImportFail}
    />
  </Dialog>
);
