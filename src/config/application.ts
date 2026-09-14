import type { ObjectType } from "../types";

export const APP_NAME = "SENTINEL";

export const AUTH_POLICY = {
  maxFailedAttempts: 5,
  minimumPasswordLength: 8,
  mfaCodeLength: 6,
  mfaExpirySeconds: 30,
  mfaExpiredCode: "000000",
  sessionCountdownSeconds: 120,
  sessionWarningMs: 28 * 60 * 1000,
  simulatedLatencyMs: 220,
  lockoutMessage: "Too many failed attempts. Try again in 15 minutes, or reset your password.",
} as const;

export const UI_TIMING = {
  dismissDelayMs: 800,
  resolutionExitMs: 300,
  graphFallbackMs: 2000,
} as const;

export const CASE_POLICY = {
  titleMaxLength: 120,
  numberStart: 1100,
} as const;

export const CONTENT_POLICY = {
  manualEntryJustificationMaxLength: 1000,
  manualEntryJustificationWarningLength: 900,
} as const;

export const GRAPH_POLICY = {
  minimumHops: 1,
  maximumHops: 3,
  nodeRadius: { minimum: 20, maximum: 40, increment: 3 },
  linkDistance: 110,
  chargeStrength: -320,
  collisionPadding: 18,
  node: { width: 196, height: 60, columnGap: 96, rowGap: 32, canvasInset: 56 },
  rendering: { labelVisibilityScale: 0.58, edgeHitWidth: 14, progressiveNodeLimit: 500 },
  zoom: { minimum: 0.15, maximum: 4, inFactor: 1.25, outFactor: 0.8 },
  colors: {
    edge: "var(--graph-edge)",
    edgeActive: "var(--graph-edge-active)",
    edgeSelected: "var(--graph-edge-selected)",
    origin: "var(--accent)",
    selection: "var(--graph-selection)",
    label: "var(--paper)",
    muted: "var(--ink-secondary)",
  },
} as const;

export const OBJECT_TYPE_COLORS: Record<ObjectType, string> = {
  Person: "var(--type-person)",
  Organization: "var(--type-organization)",
  Phone: "var(--type-phone)",
  Location: "var(--type-location)",
  JobListing: "var(--type-job)",
  Document: "var(--type-document)",
  Case: "var(--type-case)",
};
