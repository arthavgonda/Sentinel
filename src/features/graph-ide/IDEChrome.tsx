import { type ReactNode, useMemo, useState } from "react";
import type { ObjectType, OntologyObject } from "../../types";
import { typeColor } from "../../data/mock";
import { TypeDot } from "../../ui/primitives";

export function Outliner({
  title,
  objects,
  selectedId,
  originId,
  onSelect,
  onRemove,
  editable,
  emptyLabel,
}: {
  title: string;
  objects: OntologyObject[];
  selectedId?: string | null;
  originId?: string | null;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  editable?: boolean;
  emptyLabel?: string;
}) {
  const [filter, setFilter] = useState("");

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const pool = q.length ? objects.filter((o) => o.display.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) : objects;
    const byType = new Map<ObjectType, OntologyObject[]>();
    pool.forEach((object) => {
      byType.set(object.type, [...(byType.get(object.type) ?? []), object]);
    });
    return [...byType.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [objects, filter]);

  return (
    <div className="ide-outliner">
      <div className="ide-outliner-head">
        <span className="eyebrow" style={{ margin: 0 }}>
          {title}
        </span>
        <span className="ide-outliner-count">{objects.length}</span>
      </div>
      <input
        className="ide-outliner-filter"
        placeholder="Filter…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        aria-label={`Filter ${title.toLowerCase()}`}
      />
      <div className="ide-outliner-tree">
        {groups.length === 0 ? (
          <p className="muted" style={{ padding: "6px 4px" }}>
            {emptyLabel ?? "Nothing here yet."}
          </p>
        ) : (
          groups.map(([type, items]) => (
            <div className="ide-outliner-group" key={type}>
              <div className="ide-outliner-group-label">
                <TypeDot color={typeColor(type)} size={7} />
                {type}
                <span>{items.length}</span>
              </div>
              {items.map((object) => (
                <button
                  key={object.id}
                  className={`ide-outliner-row ${selectedId === object.id ? "active" : ""} ${originId === object.id ? "origin" : ""}`}
                  onClick={() => onSelect(object.id)}
                >
                  <span className="truncate grow">{object.display}</span>
                  {originId === object.id ? <span className="ide-outliner-origin-tag">Origin</span> : null}
                  {editable && onRemove ? (
                    <span
                      className="ide-outliner-remove"
                      role="button"
                      aria-label={`Remove ${object.display}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(object.id);
                      }}
                    >
                      ×
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function StatusBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="ide-statusbar">
      <div className="ide-statusbar-left">{left}</div>
      <div className="ide-statusbar-right">{right}</div>
    </div>
  );
}

export function ViewportGizmo({ hops, zoom }: { hops: number; zoom: number }) {
  return (
    <div className="viewport-gizmo" aria-hidden>
      <div className="viewport-gizmo-ring">{hops}</div>
      <div className="viewport-gizmo-zoom">{Math.round(zoom * 100)}%</div>
    </div>
  );
}