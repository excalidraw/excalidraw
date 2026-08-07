import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { serializeAsJSON } from "@excalidraw/excalidraw";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import React, { useCallback, useEffect, useRef, useState } from "react";

import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import {
  GitHubManager,
  type GitHubBranch,
  type GitHubConfig,
  type GitHubRepo,
} from "../data/GitHubManager";

import { atom, useAtom } from "../app-jotai";

import "./GitHubDialog.scss";

// ---------------------------------------------------------------------------
// Global dialog state atom
// ---------------------------------------------------------------------------
export const gitHubSaveDialogOpenAtom = atom(false);
export const gitHubSaveQuickModeAtom = atom(false);
export const activeGitHubConfigAtom = atom<GitHubConfig | null>(
  GitHubManager.getConfig(),
);

// ---------------------------------------------------------------------------
// GitHub SVG icon (simple Octocat outline)
// ---------------------------------------------------------------------------
export const GitHubIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.468-2.382 1.236-3.222-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.5 11.5 0 0 1 3.003-.404c1.02.005 2.047.138 3.003.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .322.216.694.825.576C20.565 21.795 24 17.298 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------
type Step = "token" | "repo" | "commit" | "success";

type Props = {
  excalidrawAPI: {
    getSceneElements: () => readonly OrderedExcalidrawElement[];
    getAppState: () => AppState;
    getFiles: () => BinaryFiles;
    getName: () => string;
  } | null;
};

function buildCommitMessage(filename: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5);
  return `Save ${filename} @ ${date} ${time}`;
}

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------
export const GitHubSaveDialog: React.FC<Props> = ({ excalidrawAPI }) => {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useAtom(gitHubSaveDialogOpenAtom);
  const [isQuickMode, setIsQuickMode] = useAtom(gitHubSaveQuickModeAtom);
  const [, setActiveConfig] = useAtom(activeGitHubConfigAtom);

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

  const savedConfig = GitHubManager.getConfig();
  const defaultFilename = excalidrawAPI?.getName() ?? "diagram.excalidraw";

  const [owner, setOwner] = useState(savedConfig?.owner ?? "");
  const [repo, setRepo] = useState(savedConfig?.repo ?? "");
  const [branch, setBranch] = useState(savedConfig?.branch ?? "");
  const [filePath, setFilePath] = useState(
    savedConfig?.path ?? defaultFilename,
  );
  const [commitMsg, setCommitMsg] = useState(
    buildCommitMessage(defaultFilename),
  );

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Re-initialise step when dialog opens
  useEffect(() => {
    if (isOpen) {
      if (isQuickMode) {
        const hasToken = !!GitHubManager.getToken();
        const cfg = GitHubManager.getConfig();
        if (hasToken && cfg) {
          setStep("commit");
          setOwner(cfg.owner);
          setRepo(cfg.repo);
          setBranch(cfg.branch);
          setFilePath(cfg.path);
          setCommitMsg(buildCommitMessage(cfg.path));
          setTokenInput("");
          setTokenError("");
          setCommitError("");
          return;
        }
        setIsQuickMode(false);
      }

      const hasToken = !!GitHubManager.getToken();
      setStep(hasToken ? "repo" : "token");
      setTokenInput("");
      setTokenError("");
      setCommitError("");
      if (hasToken) {
        fetchRepos();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isQuickMode]);

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
    } catch {
      // silently ignore — user will see empty list
    } finally {
      if (isMounted.current) {
        setLoadingRepos(false);
      }
    }
  }, []);

  const fetchBranches = useCallback(
    async (ownerVal: string, repoVal: string) => {
      const token = GitHubManager.getToken();
      if (!token || !ownerVal || !repoVal) {
        return;
      }
      setLoadingBranches(true);
      try {
        const data = await GitHubManager.listBranches(token, ownerVal, repoVal);
        if (isMounted.current) {
          setBranches(data);
        }
      } catch {
        setBranches([]);
      } finally {
        if (isMounted.current) {
          setLoadingBranches(false);
        }
      }
    },
    [],
  );

  // ---- Step: validate token ----
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

  // ---- Step: repo selection → move to commit ----
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

  const handleProceedToCommit = () => {
    if (!owner || !repo || !branch) {
      return;
    }
    setFilePath(
      (prev) => prev || excalidrawAPI?.getName() || "diagram.excalidraw",
    );
    setCommitMsg(
      buildCommitMessage(excalidrawAPI?.getName() ?? "diagram.excalidraw"),
    );
    setCommitError("");
    setStep("commit");
  };

  // ---- Step: commit ----
  const handleCommit = async () => {
    if (!excalidrawAPI) {
      return;
    }
    const token = GitHubManager.getToken();
    if (!token) {
      setStep("token");
      return;
    }

    const config: GitHubConfig = { owner, repo, branch, path: filePath };
    GitHubManager.setConfig(config);
    setActiveConfig(config);

    const content = serializeAsJSON(
      excalidrawAPI.getSceneElements(),
      excalidrawAPI.getAppState(),
      excalidrawAPI.getFiles(),
      "local",
    );

    setCommitting(true);
    setCommitError("");
    try {
      await GitHubManager.commitFile(token, config, content, commitMsg);
      setStep("success");
    } catch (err: any) {
      setCommitError(err?.message ?? t("github.errors.commitFailed"));
    } finally {
      if (isMounted.current) {
        setCommitting(false);
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

  return (
    <Dialog
      onCloseRequest={() => {
        setIsOpen(false);
        if (isQuickMode) {
          setIsQuickMode(false);
        }
      }}
      title={
        isQuickMode
          ? t("github.save.dialogTitleQuick")
          : t("github.save.dialogTitle")
      }
      size="small"
    >
      <div className="GitHubDialog">
        {/* ---------------------------------------------------------------- */}
        {/* Step: Token                                                        */}
        {/* ---------------------------------------------------------------- */}
        {step === "token" && (
          <div className="GitHubDialog__step">
            <p className="GitHubDialog__description">
              {t("github.save.token.description")}
            </p>
            <ol className="GitHubDialog__instructions">
              <li>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Excalidraw"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("github.save.token.step1")}
                </a>
              </li>
              <li>{t("github.save.token.step2")}</li>
              <li>{t("github.save.token.step3")}</li>
            </ol>
            <TextField
              label={t("github.save.token.label")}
              placeholder={t("github.save.token.placeholder")}
              value={tokenInput}
              onChange={setTokenInput}
              isRedacted
            />
            {tokenError && (
              <p className="GitHubDialog__error">{tokenError}</p>
            )}
            <div className="GitHubDialog__actions">
              <FilledButton
                label={
                  validating
                    ? t("github.save.token.connectingBtn")
                    : t("github.save.token.connectBtn")
                }
                disabled={validating}
                onClick={handleConnect}
              />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step: Select repo & branch                                        */}
        {/* ---------------------------------------------------------------- */}
        {step === "repo" && (
          <div className="GitHubDialog__step">
            <p className="GitHubDialog__description">
              {t("github.save.repo.description")}
            </p>

            {loadingRepos ? (
              <p>{t("github.save.repo.loadingRepos")}</p>
            ) : (
              <div className="GitHubDialog__field">
                <label className="GitHubDialog__label">
                  {t("github.save.repo.repoLabel")}
                </label>
                <select
                  className="GitHubDialog__select"
                  value={owner && repo ? `${owner}/${repo}` : ""}
                  onChange={(e) => handleRepoSelect(e.target.value)}
                >
                  <option value="">
                    {t("github.save.repo.repoPlaceholder")}
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
                  {t("github.save.repo.branchLabel")}
                </label>
                {loadingBranches ? (
                  <p>{t("github.save.repo.loadingBranches")}</p>
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
                {t("github.save.repo.disconnectBtn")}
              </button>
              <FilledButton
                label={t("github.save.repo.nextBtn")}
                disabled={!owner || !repo || !branch}
                onClick={handleProceedToCommit}
              />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step: Confirm commit                                              */}
        {/* ---------------------------------------------------------------- */}
        {step === "commit" && (
          <div className="GitHubDialog__step">
            <p className="GitHubDialog__description">
              {t("github.save.commit.description")
                .replace("{{owner}}", owner)
                .replace("{{repo}}", repo)
                .replace("{{branch}}", branch)}
            </p>

            {isQuickMode ? (
              <div className="GitHubDialog__field">
                <label className="GitHubDialog__label">
                  {t("github.save.commit.filePathLabel")}
                </label>
                <p>
                  <strong>{filePath}</strong>
                </p>
              </div>
            ) : (
              <TextField
                label={t("github.save.commit.filePathLabel")}
                value={filePath}
                onChange={setFilePath}
              />
            )}

            <TextField
              label={t("github.save.commit.commitMsgLabel")}
              value={commitMsg}
              onChange={setCommitMsg}
            />

            {commitError && (
              <p className="GitHubDialog__error">{commitError}</p>
            )}

            <div className="GitHubDialog__actions">
              {!isQuickMode && (
                <button
                  className="GitHubDialog__back"
                  onClick={() => setStep("repo")}
                >
                  {t("github.save.commit.backBtn")}
                </button>
              )}
              <FilledButton
                label={
                  committing
                    ? t("github.save.commit.committingBtn")
                    : t("github.save.commit.commitBtn")
                }
                disabled={committing || !filePath || !commitMsg}
                onClick={handleCommit}
              />
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step: Success                                                     */}
        {/* ---------------------------------------------------------------- */}
        {step === "success" && (
          <div className="GitHubDialog__step GitHubDialog__success">
            <p>
              {t("github.save.success.committed")}{" "}
              <a
                href={`https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {owner}/{repo}/{filePath}
              </a>
            </p>
            <div className="GitHubDialog__actions">
              <FilledButton
                label={t("github.save.success.doneBtn")}
                onClick={() => {
                  setIsOpen(false);
                  if (isQuickMode) {
                    setIsQuickMode(false);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
