import { useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, Building2, FileText, MapPin, Plus, Search, Smartphone, User } from "lucide-react";
import type { ObjectType, OntologyObject } from "../../types";
import { typeColor } from "../../data/mock";
import { TypeDot } from "../../ui/primitives";

const CREATABLE_TYPES: ObjectType[] = ["Person", "Organization", "Phone", "Location", "JobListing", "Document"];

export const TYPE_ICON: Record<ObjectType, typeof User> = {
  Person: User,
  Organization: Building2,
  Phone: Smartphone,
  Location: MapPin,
  JobListing: Briefcase,
  Document: FileText,
  Case: FileText,
};

const ID_PREFIX: Record<ObjectType, string> = {
  Person: "p",
  Organization: "org",
  Phone: "ph",
  Location: "loc",
  JobListing: "job",
  Document: "doc",
  Case: "case",
};

const DISPLAY_LABEL: Record<ObjectType, string> = {
  Person: "New person",
  Organization: "New organization",
  Phone: "New phone",
  Location: "New location",
  JobListing: "New job listing",
  Document: "New document",
  Case: "New case",
};

export function createObjectStub(type: ObjectType): OntologyObject {
  const suffix = (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8);
  return {
    id: `${ID_PREFIX[type]}-${suffix}`,
    type,
    display: DISPLAY_LABEL[type],
    properties: {},
    linkedCount: 0,
    firstSeen: new Date().toISOString().slice(0, 10),
  };
}

export function AddObjectMenu({
  x,
  y,
  onClose,
  onCreateNew,
  onPickExisting,
  objects,
  excludeIds,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onCreateNew: (type: ObjectType) => void;
  onPickExisting: (object: OntologyObject) => void;
  objects: OntologyObject[];
  excludeIds?: Set<string>;
}) {
  const [mode, setMode] = useState<"root" | "new" | "existing">("root");
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (mode === "existing") searchRef.current?.focus();
  }, [mode]);

  const results = useMemo(() => {
    if (mode !== "existing") return [];
    const q = query.trim().toLowerCase();
    const pool = q.length ? objects.filter((o) => o.display.toLowerCase().includes(q) || o.id.toLowerCase().includes(q)) : objects;
    return pool.slice(0, 8);
  }, [mode, query, objects]);

  const clampedX = Math.max(8, Math.min(x, window.innerWidth - 264));
  const clampedY = Math.max(8, Math.min(y, window.innerHeight - 340));

  return (
    <div ref={rootRef} className="add-object-menu" style={{ left: clampedX, top: clampedY }} role="menu">
      {mode === "root" ? (
        <>
          <div className="add-object-menu-title">Add</div>
          <button className="add-object-menu-item" onClick={() => setMode("new")}>
            <Plus size={14} strokeWidth={1.5} />
            New Empty Object
            <span className="add-object-menu-chevron">›</span>
          </button>
          <button className="add-object-menu-item" onClick={() => setMode("existing")}>
            <Search size={14} strokeWidth={1.5} />
            Add Existing…
            <span className="add-object-menu-chevron">›</span>
          </button>
        </>
      ) : null}

      {mode === "new" ? (
        <>
          <div className="add-object-menu-title">
            <button className="add-object-menu-back" aria-label="Back" onClick={() => setMode("root")}>
              ‹
            </button>
            New Empty Object
          </div>
          {CREATABLE_TYPES.map((type) => {
            const Icon = TYPE_ICON[type];
            return (
              <button
                key={type}
                className="add-object-menu-item"
                onClick={() => {
                  onCreateNew(type);
                  onClose();
                }}
              >
                <TypeDot color={typeColor(type)} size={9} />
                <Icon size={14} strokeWidth={1.5} />
                {type}
              </button>
            );
          })}
        </>
      ) : null}

      {mode === "existing" ? (
        <>
          <div className="add-object-menu-title">
            <button className="add-object-menu-back" aria-label="Back" onClick={() => setMode("root")}>
              ‹
            </button>
            Add Existing
          </div>
          <input
            ref={searchRef}
            className="add-object-menu-search"
            placeholder="Search objects…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="add-object-menu-results">
            {results.length === 0 ? (
              <div className="add-object-menu-empty">No matches</div>
            ) : (
              results.map((object) => {
                const disabled = excludeIds?.has(object.id) ?? false;
                return (
                  <button
                    key={object.id}
                    className="add-object-menu-item"
                    disabled={disabled}
                    onClick={() => {
                      if (disabled) return;
                      onPickExisting(object);
                      onClose();
                    }}
                  >
                    <TypeDot color={typeColor(object.type)} size={9} />
                    <span className="grow truncate">{object.display}</span>
                    <span className="add-object-menu-type">{disabled ? "In case" : object.type}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}