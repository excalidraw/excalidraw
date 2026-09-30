import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { useAuth } from "./auth/AuthProvider";
import { Shell } from "./layout/Shell";
import { AuthPage } from "./pages/AuthPages";
import { Dashboard } from "./pages/Dashboard";
import { LibrariesPage } from "./pages/LibrariesPage";
import { SettingsPage } from "./pages/SettingsPage";

// The editor is heavy: keep it out of the dashboard bundle.
const ScenePage = lazy(() => import("./pages/ScenePage"));
const SharedScenePage = lazy(() => import("./pages/SharedScenePage"));

const Loading = () => <div className="center-screen muted">Loading…</div>;

const RequireAuth = () => {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return <Loading />;
  }
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: loc.pathname + loc.search }}
      />
    );
  }
  return <Outlet />;
};

export const App = () => (
  <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/share/:token" element={<SharedScenePage />} />
      <Route path="/embed/:token" element={<SharedScenePage embed />} />
      <Route element={<RequireAuth />}>
        <Route path="/scene/:sceneId" element={<ScenePage />} />
        <Route element={<Shell />}>
          <Route index element={<Dashboard view="all" />} />
          <Route path="/w/:workspaceId" element={<Dashboard view="all" />} />
          <Route
            path="/w/:workspaceId/recent"
            element={<Dashboard view="recent" />}
          />
          <Route
            path="/w/:workspaceId/mine"
            element={<Dashboard view="mine" />}
          />
          <Route
            path="/w/:workspaceId/shared"
            element={<Dashboard view="shared" />}
          />
          <Route path="/w/:workspaceId/libraries" element={<LibrariesPage />} />
          <Route
            path="/w/:workspaceId/trash"
            element={<Dashboard view="trash" />}
          />
          <Route
            path="/w/:workspaceId/folder/:folderId"
            element={<Dashboard view="folder" />}
          />
          <Route
            path="/w/:workspaceId/settings/:tab?"
            element={<SettingsPage />}
          />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);
