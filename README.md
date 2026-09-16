# SENTINEL

**SENTINEL** is an investigative intelligence and entity resolution platform purpose-built for counter-human-trafficking operations. Inspired by intelligence-grade link-analysis systems, SENTINEL enables investigators, intelligence analysts, and data stewards to ingest, link, analyze, and resolve disparate entities—individuals, organizations, locations, phone numbers, job listings, and evidentiary documents—across complex cross-border trafficking networks without baking premature conclusions into data schemas.

---

## Capabilities & Architecture

### 1. Interactive Graph Intelligence & Link Analysis
- **Force-Directed Network Visualization**: D3-powered canvas representing entities as nodes and relationships as weighted edges, with dynamic filtering by classification, confidence, and predicate type.
- **Graph Editor**: Visual graph manipulation suite allowing analysts to expand entity neighborhoods, isolate clusters, track suspect corridors, and inspect multi-hop connection paths.
- **Entity Dossiers & Evidence Popovers**: Granular entity inspection cards showing structured metadata, property history, associated case files, intelligence notes, provenance records, and incoming/outgoing links.

### 2. Entity Resolution (ER) Engine (Go Microservice)
- **High-Performance Parallel Matching**: Standalone Go microservice executing concurrent pairwise entity comparisons across CPU cores.
- **Multi-Attribute Similarity Scoring**:
  - **Person Matching**: Unicode-safe Jaro-Winkler string similarity, phonetic Soundex encoding, normalized phone matching, location proximity, and alias resolution.
  - **Organization Matching**: Registration identifier matching, address proximity, and Jaro-Winkler name analysis.
  - **Phone & Location Matching**: Normalized E.164 and localized digit matching; normalized address string comparison.
- **Human-in-the-Loop ER Review (Data Steward Authority)**: Flagged pairwise matches with similarity scores, matched attributes, and confidence levels queued for review. In keeping with governance standards, resolution authority resides with the **Data Steward**, requiring explicit verification of both evidence packages before confirming a merge or keeping records separate.

### 3. Case Management, Governance & Two-Person Escalation
- **Dossier & Investigation Tracking**: Case files with status workflows (`Open`, `Under Review`, `Escalated`, `Closed`) and assigned lead investigators.
- **Two-Person Escalation Gate**: A structural governance safeguard preventing unilateral external handoffs. An investigator or analyst proposes an escalation to a specific partner agency; the case status is locked to `Under Review` until a designated Case Lead or Steward reviews and approves or denies the proposal with logged justification before any dossier is shared externally.
- **Investigation Signals & Safeguards**: Cases aggregate heuristic signals (e.g., shared phone numbers, closed-loop organization paths, repeated listing phrasing) with point weights. Governed by the mandatory investigative disclaimer:
  > *"This is not a probability of trafficking. It reflects why this cluster of objects became interesting."*
- **Analyst Scoping & Field Notes**: Role-based access control ensuring analysts only access cases explicitly assigned to them, with timestamped intelligence notes attached to investigations.

### 4. Data Entry & Ingestion Console
- **Object Ingestion**: Form interface for registering the core v1 ontology types: `Person`, `Organization`, `Location`, `Phone`, `JobListing`, and `Document` (evidence containers for provenance tracking).
- **Evidentiary Relationship Creation**: Connect entities using strictly neutral, observational predicates (`uses`, `associated_with`, `registered_at`, `listed_by`, `posted_by`, `linked_to`) alongside confidence scores, extraction methods (deterministic vs. probabilistic), and source attribution.
- **Source Registration**: Register intelligence feeds, law enforcement tips, field reports, and telecommunications records with legal bases and data classifications.
- **On-Demand ER Trigger**: Trigger full-corpus entity resolution sweeps directly from the ingestion workspace (Steward/Admin).

### 5. Security, RBAC & Purpose-Bound Audit Trail
- **Two-Factor Authentication**: Local credential authentication with MFA token issuance.
- **Role-Based Access Control (RBAC)**: Enforced roles across endpoints:
  - `Analyst`: View, create, link entities within assigned cases, and propose case escalations.
  - `Case Lead`: Manage case teams, author case notes, and review/approve escalation proposals.
  - `Steward`: Source registration, data governance, and Entity Resolution review & resolution authority.
  - `Admin`: User administration, system configuration, and complete audit oversight.
  - `Auditor`: Independent oversight and compliance review.
- **Purpose-Bound Audit Trail**: Non-repudiable audit logging capturing actor, action (`READ`, `WRITE`, `MERGE`, `ESCALATE`, `EXPORT`), reference, result, timestamp, and crucially a **mandatory stated investigative purpose** (`purpose`) for compliance verification.

---

## File and Folder Structure

```
Sentinel/
├── package.json               # Root scripts (dev:all, dev:api, dev:er, dev) & client dependencies
├── index.html                 # Single-page application HTML entrypoint
├── vite.config.ts             # Vite build & development server configuration
├── tsconfig.json              # TypeScript root configuration
├── tsconfig.node.json         # TypeScript configuration for Node tools
├── er-service-bin             # Precompiled Go Entity Resolution microservice binary
│
├── er-service/                # Entity Resolution Microservice (Go)
│   ├── go.mod                 # Go module definition (sentinel/er-service)
│   ├── main.go                # HTTP server (:3002), parallel pairwise worker pool, /match & /health
│   └── matching/
│       ├── algorithms.go      # Pure Go Jaro-Winkler, Soundex, and phone normalization routines
│       └── comparator.go      # Type-dispatched entity comparison & score calculation logic
│
├── backend/                   # Core Backend API Service (Node.js & TypeScript)
│   ├── package.json           # Backend dependencies (Express, jsonwebtoken, ts-node, etc.)
│   ├── tsconfig.json          # Backend TypeScript compiler settings
│   ├── .env                   # Environment config (PORT=3001, ER_SERVICE_URL, JWT_SECRET, DB_PATH)
│   ├── sentinel.db            # SQLite database file (WAL mode, foreign keys enabled)
│   └── src/
│       ├── index.ts           # Express server entrypoint (:3001), CORS, route registration & DB boot
│       ├── auth/
│       │   └── jwt.ts         # JWT generation, verification, session and MFA token management
│       ├── db/
│       │   ├── connection.ts  # Node 26 node:sqlite DatabaseSync connection & typed query helpers
│       │   ├── schema.sql     # DDL definitions (users, objects, links, cases, notes, audit, ER, sources)
│       │   └── seed.ts        # Idempotent seed data for initial setup (sample trafficking network)
│       ├── middleware/
│       │   ├── auth.ts        # requireAuth and requireRole RBAC middleware factories
│       │   └── audit.ts       # Response-intercepting audit logger recording to SQLite audit_log
│       ├── routes/
│       │   ├── auth.ts        # Authentication routes (/login, /mfa/verify, /me)
│       │   ├── objects.ts     # Entity CRUD, filtering, property updates, and link querying
│       │   ├── cases.ts       # Case management, investigator assignment, and case-entity links
│       │   ├── links.ts       # Relationship authoring and deletion
│       │   ├── notes.ts       # Investigation note creation and retrieval
│       │   ├── er.ts          # ER candidate review, manual match triggering, and pair decisions
│       │   ├── sources.ts     # Data source registration and retrieval
│       │   ├── audit.ts       # Querying audit trail entries (Admin only)
│       │   └── search.ts      # Multi-entity text search endpoint
│       └── services/
│           └── erClient.ts    # HTTP client orchestrating payload exchange with the Go ER service
│
└── src/                       # Frontend Application (React 19, TypeScript, D3)
    ├── main.tsx               # React application DOM root
    ├── App.tsx                # Client-side router, authentication gate, and layout root
    ├── types.ts               # Shared frontend TypeScript interfaces and type definitions
    ├── api/                   # Typed API client services
    │   ├── client.ts          # Fetch wrapper handling Bearer token injection and error handling
    │   ├── auth.ts            # Authentication API requests
    │   ├── objects.ts         # Entity API requests
    │   ├── cases.ts           # Case management API requests
    │   ├── links.ts           # Relationship API requests
    │   ├── notes.ts           # Notes API requests
    │   ├── er.ts              # Entity resolution API requests
    │   ├── sources.ts         # Data source API requests
    │   ├── audit.ts           # Audit log API requests
    │   └── search.ts          # Search API requests
    ├── config/                # Navigation items and global application configuration
    ├── data/                  # Initial static mocks and fallback fixtures
    ├── features/              # Feature-specific components and sub-modules
    ├── pages/                 # Full-page view components
    │   ├── Auth.tsx           # Login and MFA verification interface
    │   ├── Dashboard.tsx      # System overview, key metrics, alerts, and recent activity
    │   ├── Cases.tsx          # Case files, priority queues, and assigned investigations
    │   ├── Graph.tsx          # D3-based link analysis canvas and entity inspector
    │   ├── GraphEditor.tsx    # Interactive graph authoring and cluster exploration
    │   ├── DataEntry.tsx      # Multi-tab data entry console (Objects, Links, Cases, Sources, ER)
    │   ├── ErReview.tsx       # Entity Resolution review queue and merge/dismiss workspace
    │   ├── DataSources.tsx    # Ingested intelligence source feed registry
    │   ├── ObjectDetail.tsx   # Detailed single-entity dossier view
    │   ├── Search.tsx         # Global multi-attribute entity search
    │   ├── Audit.tsx          # Compliance and security audit log table
    │   └── Settings.tsx       # User preferences and system configuration
    ├── state/                 # Client state management stores and context providers
    ├── styles/                # Global style sheets and theme variables
    └── ui/                    # Reusable UI component library (cards, modals, badges, inputs)
```

---

## Running the Platform

### Prerequisites
- Node.js v22+ (v26 recommended for built-in `node:sqlite`)
- Go 1.23+ (if recompiling `er-service`)

### Quick Start (All Services)
To start the Go Entity Resolution microservice (`:3002`), the Node.js API backend (`:3001`), and the Vite frontend dev server (`:5173`) in one command:

```bash
npm run dev:all
```

### Starting Services Individually

1. **Go ER Microservice**:
   ```bash
   npm run dev:er
   # Or directly compile and run:
   cd er-service && go run main.go
   ```

2. **Backend API**:
   ```bash
   npm run dev:api
   ```

3. **Frontend SPA**:
   ```bash
   npm run dev
   ```

Visit `http://localhost:5173` to access the SENTINEL investigative workspace.
