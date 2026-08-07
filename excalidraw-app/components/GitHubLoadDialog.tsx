import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { atom, useAtom } from "../app-jotai";
import {
  GitHubManager,
  type GitHubBranch,
  type GitHubFile,
  type GitHubRepo,
} from "../data/GitHubManager";

import { useSetAtom } from "../app-jotai";

import { GitHubIcon } from "./GitHubSaveDialog";
import { activeGitHubConfigAtom } from "./GitHubSaveDialog";

// ---------------------------------------------------------------------------
// Atom
// ---------------------------------------------------------------------------
export const gitHubLoadDialogOpenAtom = atom(false);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = "token" | "repo" | "files" | "loading";

export type LoadedScene = {
  json: string;
  /** Repo config at load time — pre-fills the save dialog */
  config: { owner: string; repo: string; branch: string; path: string };
};

type Props = {
  onLoad: (scene: LoadedScene) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const GitHubLoadDialog: React.FC<Props> = ({ onLoad }) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useAtom(gitHubLoadDialogOpenAtom);
  const setActiveConfig = useSetAtom(activeGitHubConfigAtom);

  const [step, setStep] = useState<Step>(() =>
    GitHubManager.getToken() ? "repo" : "token",
  );
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [validating, setValidating] = useState(false);

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");

  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [filter, setFilter] = useState("");

  const [loadError, setLoadError] = useState("");

  const [newFilePath, setNewFilePath] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Re-init on open
  useEffect(() => {
    if (isOpen) {
      const hasToken = !!GitHubManager.getToken();
      setStep(hasToken ? "repo" : "token");
      setTokenInput("");
      setTokenError("");
      setLoadError("");
      setFilesError("");
      setFiles([]);
      setFilter("");
      if (hasToken) {
        fetchRepos();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchRepos = useCallback(async () => {
    const token = GitHubManager.getToken();
    if (!token) {
      return;
    }
    setLoadingRepos(true);
    try {
      const data = await GitHubManager.listRepos(token);
      if (isMounted.current) {
        setRepos(data);
      }
    } finally {
      if (isMounted.current) {
        setLoadingRepos(false);
      }
    }
  }, []);

  const fetchBranches = useCallback(
    async (ownerVal: string, repoVal: string) => {
      const token = GitHubManager.getToken();
      if (!token) {
        return;
      }
      setLoadingBranches(true);
      try {
        const data = await GitHubManager.listBranches(token, ownerVal, repoVal);
        if (isMounted.current) {
          setBranches(data);
        }
      } catch {
        if (isMounted.current) {
          setBranches([]);
        }
      } finally {
        if (isMounted.current) {
          setLoadingBranches(false);
        }
      }
    },
    [],
  );

  const fetchFiles = useCallback(
    async (ownerVal: string, repoVal: string, branchVal: string) => {
      const token = GitHubManager.getToken();
      if (!token) {
        return;
      }
      setLoadingFiles(true);
      setFilesError("");
      setFiles([]);
      try {
        const data = await GitHubManager.listExcalidrawFiles(
          token,
          ownerVal,
          repoVal,
          branchVal,
        );
        if (isMounted.current) {
          setFiles(data);
          if (data.length === 0) {
            setFilesError(t("github.load.files.noFiles"));
          }
        }
      } catch (err: any) {
        if (isMounted.current) {
          setFilesError(err?.message ?? t("github.errors.listFailed"));
        }
      } finally {
        if (isMounted.current) {
          setLoadingFiles(false);
        }
      }
    },
    [t],
  );

  // ---- Token step ----
  const handleConnect = async () => {
    const tok = tokenInput.trim();
    if (!tok) {
      setTokenError(t("github.errors.enterToken"));
      return;
    }
    setValidating(true);
    setTokenError("");
    try {
      await GitHubManager.validateToken(tok);
      GitHubManager.setToken(tok);
      await fetchRepos();
      setStep("repo");
    } catch (err: any) {
      setTokenError(err?.message ?? t("github.errors.invalidToken"));
    } finally {
      if (isMounted.current) {
        setValidating(false);
      }
    }
  };

  // ---- Repo step ----
  const handleRepoSelect = (value: string) => {
    const found = repos.find((r) => r.full_name === value);
    if (!found) {
      return;
    }
    setOwner(found.owner.login);
    setRepo(found.name);
    setBranch(found.default_branch);
    fetchBranches(found.owner.login, found.name);
  };

  const handleBrowseFiles = () => {
    if (!owner || !repo || !branch) {
      return;
    }
    setFilter("");
    setStep("files");
    fetchFiles(owner, repo, branch);
  };

  // ---- File selection ----
  const handleSelectFile = async (filePath: string) => {
    const token = GitHubManager.getToken();
    if (!token) {
      setStep("token");
      return;
    }
    setStep("loading");
    setLoadError("");
    try {
      const json = await GitHubManager.getFileContent(
        token,
        owner,
        repo,
        branch,
        filePath,
      );
      const config = { owner, repo, branch, path: filePath };
      // Persist config so the save dialog is pre-filled with this file
      GitHubManager.setConfig(config);
      setActiveConfig(config);
      onLoad({ json, config });
      setIsOpen(false);
    } catch (err: any) {
      if (isMounted.current) {
        setLoadError(err?.message ?? t("github.errors.loadFailed"));
        setStep("files");
      }
    }
  };

  const handleCreateFile = async () => {
    const token = GitHubManager.getToken();
    if (!token) {
      setStep("token");
      return;
    }

    const submittedPath = newFilePath.trim();
    if (!submittedPath) {
      return;
    }

    const path = submittedPath.endsWith(".excalidraw")
      ? submittedPath
      : `${submittedPath}.excalidraw`;

    setCreatingFile(true);
    setLoadError("");
    try {
      const json = JSON.stringify(
        {
          type: "excalidraw",
          version: 2,
          source: "https://excalidraw.com",
          elements: [],
          appState: {
            viewBackgroundColor: "#ffffff",
            gridSize: null,
          },
          files: {},
        },
        null,
        2,
      );

      const config = { owner, repo, branch, path };
      await GitHubManager.commitFile(token, config, json, `Create ${path}`);

      GitHubManager.setConfig(config);
      setActiveConfig(config);
      onLoad({ json, config });
      setIsOpen(false);
    } catch (err: any) {
      if (isMounted.current) {
        setLoadError(err?.message ?? t("github.errors.createFailed"));
      }
    } finally {
      if (isMounted.current) {
        setCreatingFile(false);
      }
    }
  };

  const handleDisconnect = () => {
    GitHubManager.clearToken();
    setRepos([]);
    setBranches([]);
    setOwner("");
    setRepo("");
    setBranch("");
    setStep("token");
  };

  if (!isOpen) {
    return null;
  }

  const filteredFiles = filter
    ? files.filter((f) => f.path.toLowerCase().includes(filter.toLowerCase()))
    : files;

  return (
    <Dialog
      onCloseRequest={() => setIsOpen(false)}
      title={t("github.load.dialogTitle")}
      size="small"
    >
      <div className="GitHubSaveDialog">
        {/* ---- Token ---- */}
        {step === "token" && (
          <div className="GitHubDialog__step">
            <p className="GitHubDialog__description">
              {t("github.load.token.description")}
            </p>
            <ol className="GitHubDialog__instructions">
              <li>
                <a
                  className="button button--secondary button--lg"
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Excalidraw"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("github.load.token.step1")}
                </a>{" "}
                {t("github.load.token.step2")}
              </li>
              <li>{t("github.load.token.step3")}</li>
            </ol>
            <TextField
              label={t("github.save.token.label")}
              placeholder={t("github.save.token.placeholder")}
              value={tokenInput}
              onChange={setTokenInput}
            />
            {tokenError && (
              <p className="GitHubDialog__error">{tokenError}</p>
            )}
            <div className="GitHubDialog__actions">
              <FilledButton
                label={
                  validating
                    ? t("github.load.token.connectingBtn")
                    : t("github.load.token.connectBtn")
                }
                disabled={validating}
                onClick={handleConnect}
              />
            </div>
          </div>
        )}

        {/* ---- Repo + branch ---- */}
        {step === "repo" && (
          <div className="GitHubDialog__step">
            <p className="GitHubDialog__description">
              {t("github.load.repo.description")}
            </p>

            {loadingRepos ? (
              <p>{t("github.load.repo.loadingRepos")}</p>
            ) : (
              <div className="GitHubDialog__field">
                <label className="GitHubDialog__label">
                  {t("github.load.repo.repoLabel")}
                </label>
                <select
                  className="GitHubDialog__select"
                  value={owner && repo ? `${owner}/${repo}` : ""}
                  onChange={(e) => handleRepoSelect(e.target.value)}
                >
                  <option value="">
                    {t("github.load.repo.repoPlaceholder")}
                  </option>
                  {repos.map((r) => (
                    <option key={r.full_name} value={r.full_name}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {owner && repo && (
              <div className="GitHubDialog__field">
                <label className="GitHubDialog__label">
                  {t("github.load.repo.branchLabel")}
                </label>
                {loadingBranches ? (
                  <p>{t("github.load.repo.loadingBranches")}</p>
                ) : (
                  <select
                    className="GitHubDialog__select"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="GitHubDialog__actions">
              <button
                className="GitHubDialog__disconnect"
                onClick={handleDisconnect}
              >
                {t("github.load.repo.disconnectBtn")}
              </button>
              <FilledButton
                label={t("github.load.repo.browseBtn")}
                disabled={!owner || !repo || !branch}
                onClick={handleBrowseFiles}
              />
            </div>
          </div>
        )}

        {/* ---- File browser ---- */}
        {step === "files" && (
          <div className="GitHubDialog__step">
            <p className="GitHubDialog__description">
              <strong>
                {owner}/{repo}
              </strong>{" "}
              — <em>{branch}</em>
            </p>

            {loadingFiles ? (
              <p>{t("github.load.files.loadingFiles")}</p>
            ) : filesError ? (
              <>
                <p className="GitHubDialog__error">{filesError}</p>

                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--color-gray-30)",
                  }}
                >
                  <p
                    className="GitHubDialog__description"
                    style={{ marginBottom: "0.5rem" }}
                  >
                    {t("github.load.files.createNewLabel")}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <TextField
                        placeholder={t("github.load.files.newFilePlaceholder")}
                        value={newFilePath}
                        onChange={setNewFilePath}
                      />
                    </div>
                    <FilledButton
                      label={
                        creatingFile
                          ? t("github.load.files.creatingBtn")
                          : t("github.load.files.createBtn")
                      }
                      disabled={creatingFile || !newFilePath.trim()}
                      onClick={handleCreateFile}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {files.length > 5 && (
                  <TextField
                    label={t("github.load.files.filterLabel")}
                    placeholder={t("github.load.files.filterPlaceholder")}
                    value={filter}
                    onChange={setFilter}
                  />
                )}
                <div className="GitHubDialog__fileList">
                  {filteredFiles.map((f) => (
                    <button
                      key={f.path}
                      className="GitHubDialog__fileItem"
                      onClick={() => handleSelectFile(f.path)}
                    >
                      <span className="GitHubDialog__fileIcon">📄</span>
                      <span className="GitHubDialog__filePath">{f.path}</span>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--color-gray-30)",
                  }}
                >
                  <p
                    className="GitHubDialog__description"
                    style={{ marginBottom: "0.5rem" }}
                  >
                    {t("github.load.files.createNewLabel")}
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <div style={{ flex: 1 }}>
                      <TextField
                        placeholder={t("github.load.files.newFilePlaceholder")}
                        value={newFilePath}
                        onChange={setNewFilePath}
                      />
                    </div>
                    <FilledButton
                      label={
                        creatingFile
                          ? t("github.load.files.creatingBtn")
                          : t("github.load.files.createBtn")
                      }
                      disabled={creatingFile || !newFilePath.trim()}
                      onClick={handleCreateFile}
                    />
                  </div>
                </div>
              </>
            )}

            {loadError && (
              <p className="GitHubDialog__error">{loadError}</p>
            )}

            <div className="GitHubDialog__actions">
              <button
                className="GitHubDialog__back"
                onClick={() => setStep("repo")}
              >
                {t("github.load.files.backBtn")}
              </button>
            </div>
          </div>
        )}

        {/* ---- Loading ---- */}
        {step === "loading" && (
          <div className="GitHubDialog__step">
            <p className="GitHubDialog__description">
              {t("github.load.loading.message")}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
};

// Re-export GitHubIcon so callers that only import from this module still work
export { GitHubIcon };
