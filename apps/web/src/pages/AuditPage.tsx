import type { AuditEntry, SessionUser } from "@sm/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { api, errorText } from "../api";
import { ErrorNote } from "../components/Field";

const PAGE = 50;
const LABELS: Record<string, string> = {
  "org.created": "Organization created",
  "org.updated": "Organization renamed",
  "member.added": "Member added",
  "member.updated": "Member changed",
  "member.password_reset": "Password reset by admin",
};

export function AuditPage(_props: { user: SessionUser }) {
  const { orgId = "" } = useParams();
  const q = useInfiniteQuery({
    queryKey: ["audit", orgId],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      api<AuditEntry[]>("GET", `/api/orgs/${orgId}/audit?limit=${PAGE}${pageParam ? `&before=${pageParam}` : ""}`),
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1]?.id : undefined),
  });
  const entries = q.data?.pages.flat() ?? [];

  return (
    <section className="stack">
      <h1>Activity</h1>
      {q.isError && <ErrorNote error={errorText(q.error)} />}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{new Date(e.at).toLocaleString()}</td>
                <td>{e.actorName ?? "System"}</td>
                <td>{LABELS[e.action] ?? e.action}</td>
                <td className="details">
                  <code>{JSON.stringify(e.after ?? e.before ?? {})}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q.hasNextPage && (
        <button className="btn" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          Load older
        </button>
      )}
    </section>
  );
}
