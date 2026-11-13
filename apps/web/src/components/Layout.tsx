import type { SessionUser } from "@sm/shared";
import { Link, NavLink, Outlet, useMatch } from "react-router";
import { api } from "../api";
import { canIn, membershipFor, useSetMe } from "../session";

export function Layout({ user }: { user: SessionUser }) {
  const match = useMatch("/o/:orgId/*");
  const orgId = match?.params.orgId;
  const org = membershipFor(user, orgId);
  const setMe = useSetMe();

  async function signOut() {
    await api("POST", "/api/auth/logout").catch(() => undefined);
    setMe(null);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link to={org ? `/o/${org.orgId}` : "/"} className="brand">
          Smoker Matchmaker
          {org && <span className="brand-org">{org.orgName}</span>}
        </Link>
        <nav className="nav">
          {org && canIn(user, orgId, "users.manage") && <NavLink to={`/o/${org.orgId}/members`}>Members</NavLink>}
          {org && canIn(user, orgId, "audit.read") && <NavLink to={`/o/${org.orgId}/audit`}>Activity</NavLink>}
          {user.memberships.length > 1 && <NavLink to="/" end>Switch</NavLink>}
          <NavLink to="/account">{user.displayName}</NavLink>
          <button type="button" className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
