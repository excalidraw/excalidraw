const AUTH_SERVER_URL =
  import.meta.env.VITE_APP_AUTH_SERVER_URL ||
  import.meta.env.VITE_APP_ROOM_SERVER_URL ||
  import.meta.env.VITE_APP_WS_SERVER_URL;

export type AuthUser = {
  id: number;
  qqOpenid: string;
  nickname: string;
  avatarUrl: string | null;
};

export type AuthState =
  | { status: "loading"; user: null }
  | { status: "guest"; user: null }
  | { status: "authenticated"; user: AuthUser };

export const getAuthServerUrl = () => AUTH_SERVER_URL;

export const fetchCurrentUser = async (): Promise<AuthUser | null> => {
  if (!AUTH_SERVER_URL) {
    return null;
  }

  const response = await fetch(`${AUTH_SERVER_URL}/api/auth/me`, {
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { user: AuthUser | null };
  return data.user;
};

export const getQqLoginUrl = (returnTo = window.location.pathname) => {
  const url = new URL(`${AUTH_SERVER_URL}/api/auth/qq/login`);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
};

export const logout = async () => {
  if (!AUTH_SERVER_URL) {
    return;
  }

  await fetch(`${AUTH_SERVER_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
};
