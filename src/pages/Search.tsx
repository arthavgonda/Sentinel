import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { typeColor } from "../data/mock";
import { useStore } from "../state/store";
import type { ObjectType } from "../types";
import { TypeDot } from "../ui/primitives";

const TYPES: ObjectType[] = [
  "Person",
  "Organization",
  "Phone",
  "Location",
  "JobListing",
  "Document",
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const { objects } = useStore();
  const [types, setTypes] = useState<ObjectType[]>([]);
  const nav = useNavigate();

  const { base, typeCounts } = useMemo(() => {
    const all = objects.filter(
      (o) =>
        !q.trim() ||
        matchStr(o.display, q) ||
        matchStr(o.id, q) ||
        Object.values(o.properties).some((v) => matchStr(v, q)),
    );
    const counts: Record<string, number> = {};
    for (const t of TYPES) counts[t] = all.filter((o) => o.type === t).length;
    return { base: all, typeCounts: counts };
  }, [objects, q]);

  const results = base.filter(
    (o) => types.length === 0 || types.includes(o.type),
  );

  return (
    <div>
      <div className="page-head">
        <h1 className="serif page-title">Search</h1>
      </div>

      <input
        className="field"
        style={{ maxWidth: 640, marginBottom: 24, height: 44, fontSize: 15 }}
        value={q}
        autoFocus={!q}
        onChange={(e) => setParams({ q: e.target.value })}
        placeholder="Search phone, name, organization, address, case…"
        aria-label="Search"
      />

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        <aside>
          <div className="panel" style={{ padding: 16 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>
              Filter by Type
            </p>
            {TYPES.map((t) => (
              <label
                key={t}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  margin: "8px 0",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={types.includes(t)}
                  onChange={(e) =>
                    setTypes((cur) =>
                      e.target.checked
                        ? [...cur, t]
                        : cur.filter((x) => x !== t),
                    )
                  }
                />
                <TypeDot color={typeColor(t)} />
                {t}
                <span className="muted">({typeCounts[t] ?? 0})</span>
              </label>
            ))}
          </div>
        </aside>

        <div>
          {q.trim() && results.length === 0 ? (
            <div className="empty">
              <p className="empty-title">No results for '{q}'</p>
              <p className="muted">
                Try a broader search term, or check the spelling.
              </p>
            </div>
          ) : !q.trim() ? (
            <div className="empty">
              <p className="muted">Type to search objects.</p>
            </div>
          ) : (
            results.map((o) => (
              <div
                key={o.id}
                className="panel"
                style={{ padding: 16, marginBottom: 10, cursor: "pointer" }}
                role="button"
                tabIndex={0}
                onClick={() =>
                  nav(`/objects/${o.id}`, { state: { from: "search" } })
                }
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  nav(`/objects/${o.id}`, { state: { from: "search" } })
                }
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <TypeDot color={typeColor(o.type)} />
                  <span style={{ fontSize: 15, fontWeight: 500 }}>
                    {o.display}
                  </span>
                  <span className="muted">{o.type}</span>
                </div>
                <p className="muted" style={{ marginBottom: 4 }}>
                  {Object.values(o.properties).slice(0, 2).join(" · ")}
                </p>
                <p className="muted">Linked to {o.linkedCount} objects</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function matchStr(v: string, q: string) {
  return v.toLowerCase().includes(q.toLowerCase());
}
