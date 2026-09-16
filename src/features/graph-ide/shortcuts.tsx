import { useEffect, useRef } from "react";

export type ShortcutCombo = string;

export type ShortcutDefinition = {
  id: string;
  combo: ShortcutCombo;
  label: string;
  description: string;
};

export const SHORTCUTS = {
  toggleGlobalSearch: {
    id: "toggleGlobalSearch",
    combo: "mod+k",
    label: "⌘K",
    description: "Toggle and focus the global search bar.",
  },
  commandPalette: {
    id: "commandPalette",
    combo: "mod+k",
    label: "⌘K",
    description: "Open command palette.",
  },
  addObject: {
    id: "addObject",
    combo: "shift+a",
    label: "Shift+A",
    description: "Open the Add menu at the cursor.",
  },
  copySelection: {
    id: "copySelection",
    combo: "mod+c",
    label: "⌘C",
    description: "Copy the selected entities.",
  },
  cutSelection: {
    id: "cutSelection",
    combo: "mod+x",
    label: "⌘X",
    description: "Cut the selected entities.",
  },
  pasteSelection: {
    id: "pasteSelection",
    combo: "mod+v",
    label: "⌘V",
    description: "Paste entities into the active case.",
  },
  undo: {
    id: "undo",
    combo: "mod+z",
    label: "⌘Z",
    description: "Undo last action.",
  },
  redo: {
    id: "redo",
    combo: "mod+shift+z",
    label: "⌘⇧Z",
    description: "Redo last undone action.",
  },
  zoomIn: {
    id: "zoomIn",
    combo: "=",
    label: "+",
    description: "Zoom in.",
  },
  zoomOut: {
    id: "zoomOut",
    combo: "-",
    label: "-",
    description: "Zoom out.",
  },
  zoomFit: {
    id: "zoomFit",
    combo: "f",
    label: "F",
    description: "Zoom to fit all nodes.",
  },
  zoomReset: {
    id: "zoomReset",
    combo: "0",
    label: "0",
    description: "Reset zoom to 100%.",
  },
  autoArrange: {
    id: "autoArrange",
    combo: "mod+shift+a",
    label: "⌘⇧A",
    description: "Auto-arrange nodes.",
  },
  save: {
    id: "save",
    combo: "mod+s",
    label: "⌘S",
    description: "Save the active case.",
  },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutName = keyof typeof SHORTCUTS;

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function matchesShortcut(event: KeyboardEvent, combo: ShortcutCombo): boolean {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  if (eventKey !== key) return false;

  const needsMod = mods.includes("mod");
  const needsShift = mods.includes("shift");
  const needsAlt = mods.includes("alt");
  const needsCtrl = mods.includes("ctrl");
  const needsMeta = mods.includes("meta");
  const hasMod = event.ctrlKey || event.metaKey;

  if (needsMod && !hasMod) return false;
  if (!needsMod && !needsCtrl && event.ctrlKey) return false;
  if (!needsMod && !needsMeta && event.metaKey) return false;
  if (needsCtrl && !event.ctrlKey) return false;
  if (needsMeta && !event.metaKey) return false;
  if (needsShift !== event.shiftKey) return false;
  if (needsAlt !== event.altKey) return false;

  return true;
}

export function useShortcut(
  combo: ShortcutCombo,
  handler: (event: KeyboardEvent) => void,
  options: { enabled?: boolean; allowInEditableFields?: boolean } = {},
) {
  const { enabled = true, allowInEditableFields = false } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!matchesShortcut(event, combo)) return;
      const target = event.target as HTMLElement | null;
      if (!allowInEditableFields && target && EDITABLE_TAGS.has(target.tagName)) return;
      event.preventDefault();
      handlerRef.current(event);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, enabled, allowInEditableFields]);
}