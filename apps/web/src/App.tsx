import { Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { AccountPage } from "./pages/AccountPage";
import { AuditPage } from "./pages/AuditPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { MembersPage } from "./pages/MembersPage";
import { OrgHomePage } from "./pages/OrgHomePage";
import { OrgPickerPage } from "./pages/OrgPickerPage";
import { useMe } from "./session";

export function App() {
  const me = useMe();
  if (me.isPending) return <div className="splash">Loading…</div>;
  if (me.isError) return <div className="splash">Can't reach the server. Refresh to try again.</div>;
  if (!me.data) return <LoginPage />;
  if (me.data.mustChangePassword) return <ChangePasswordPage forced />;

  const only = me.data.memberships.length === 1 ? me.data.memberships[0] : undefined;
  return (
    <Routes>
      <Route element={<Layout user={me.data} />}>
        <Route index element={only ? <Navigate to={`/o/${only.orgId}`} replace /> : <OrgPickerPage user={me.data} />} />
        <Route path="o/:orgId" element={<OrgHomePage user={me.data} />} />
        <Route path="o/:orgId/members" element={<MembersPage user={me.data} />} />
        <Route path="o/:orgId/audit" element={<AuditPage user={me.data} />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
