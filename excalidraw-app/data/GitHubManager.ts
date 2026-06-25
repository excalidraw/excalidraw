const STORAGE_KEY_TOKEN = "excalidraw-github-token";
const STORAGE_KEY_CONFIG = "excalidraw-github-config";
const API_BASE = "https://api.github.com";

export type GitHubConfig = {
  owner: string;
  repo: string;
  branch: string;
  path: string;
};

export type GitHubRepo = {
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
};

export type GitHubBranch = {
  name: string;
};

export type GitHubFile = {
  path: string;
  sha: string;
};

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
});

async function ghFetch<T>(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers(token), ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `GitHub API error ${res.status}: ${path}`);
  }
  return res.json();
}

export const GitHubManager = {
  // ---------------------------------------------------------------------------
  // Token management
  // ---------------------------------------------------------------------------

  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  },

  setToken(token: string) {
    localStorage.setItem(STORAGE_KEY_TOKEN, token);
  },

  clearToken() {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  },

  // ---------------------------------------------------------------------------
  // Config management (last-used repo/branch/path)
  // ---------------------------------------------------------------------------

  getConfig(): GitHubConfig | null {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as GitHubConfig;
    } catch {
      return null;
    }
  },

  setConfig(config: GitHubConfig) {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  },

  // ---------------------------------------------------------------------------
  // GitHub API wrappers
  // ---------------------------------------------------------------------------

  /** Validate a token and return the authenticated user's login. */
  async validateToken(token: string): Promise<string> {
    const user = await ghFetch<{ login: string }>(token, "/user");
    return user.login;
  },

  /** List repos accessible to the authenticated user (up to 100). */
  async listRepos(token: string): Promise<GitHubRepo[]> {
    return ghFetch<GitHubRepo[]>(
      token,
      "/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator",
    );
  },

  /** List branches for a repo. */
  async listBranches(
    token: string,
    owner: string,
    repo: string,
  ): Promise<GitHubBranch[]> {
    return ghFetch<GitHubBranch[]>(
      token,
      `/repos/${owner}/${repo}/branches?per_page=100`,
    );
  },

  /**
   * List all `.excalidraw` files in a repo using the Git Trees API.
   * Falls back to an empty array on oversized repos (truncated tree).
   */
  async listExcalidrawFiles(
    token: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<GitHubFile[]> {
    // Resolve branch → tree SHA
    const branchData = await ghFetch<{
      commit: { commit: { tree: { sha: string } } };
    }>(token, `/repos/${owner}/${repo}/branches/${branch}`);
    const treeSha = branchData.commit.commit.tree.sha;

    const tree = await ghFetch<{
      tree: { path: string; type: string; sha: string }[];
      truncated: boolean;
    }>(token, `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`);

    return tree.tree
      .filter((f) => f.type === "blob" && f.path.endsWith(".excalidraw"))
      .map((f) => ({ path: f.path, sha: f.sha }));
  },

  /**
   * Fetch and decode the text content of a single file.
   */
  async getFileContent(
    token: string,
    owner: string,
    repo: string,
    branch: string,
    path: string,
  ): Promise<string> {
    const data = await ghFetch<{ content: string; encoding: string }>(
      token,
      `/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    );
    if (data.encoding !== "base64") {
      throw new Error(`Unexpected encoding: ${data.encoding}`);
    }
    // GitHub returns base64 with newlines — strip them before decoding
    const base64 = data.content.replace(/\n/g, "");
    return decodeURIComponent(escape(atob(base64)));
  },

  /**
   * Commit a file to a GitHub repo using the Contents API.
   * Creates the file if it doesn't exist; updates it otherwise.
   */
  async commitFile(
    token: string,
    config: GitHubConfig,
    content: string,
    message: string,
  ): Promise<void> {
    const { owner, repo, branch, path } = config;
    const endpoint = `/repos/${owner}/${repo}/contents/${path}`;

    // Check if the file already exists so we can include its SHA (required for updates)
    let sha: string | undefined;
    try {
      const existing = await ghFetch<{ sha: string }>(
        token,
        `${endpoint}?ref=${branch}`,
      );
      sha = existing.sha;
    } catch {
      // File does not exist yet — that's fine, we'll create it
    }

    const body: Record<string, string> = {
      message,
      content: btoa(unescape(encodeURIComponent(content))), // UTF-8 → base64
      branch,
    };
    if (sha) {
      body.sha = sha;
    }

    await ghFetch(token, endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};
