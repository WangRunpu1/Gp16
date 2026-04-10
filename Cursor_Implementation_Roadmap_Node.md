## PV/Power System AI Design Platform: Cursor Implementation Roadmap (Node.js Stack)

### Overview

This document outlines an iterative implementation strategy for the **PV/Power System AI‑Assisted Design & Green Impact Analysis Platform**. The plan prioritizes a functional, remotely testable MVP deployed on the **UCD-provided VM**. We use a JavaScript/TypeScript stack to minimize learning overhead while still demonstrating distributed systems, databases, networking, and software engineering practices.

**Chosen stack (aligned with current implementation):**

- **Frontend**: React + TypeScript (Vite), React Flow (canvas), Ant Design (UI), ECharts (charts), Zustand (state)
- **Backend API**: Node.js + TypeScript (Fastify)
- **Async jobs**: Redis + BullMQ worker (AI layout + report generation)
- **Database**: PostgreSQL (Prisma ORM), with seeded test accounts
- **PDF reports**: HTML template rendered to PDF via Playwright/Chromium

**Remote testing requirement (from Ireland):**

- Target URL (example): `http://<VM_PUBLIC_IP>:8080`
- Testing must be possible **without registration** using seeded credentials.

---

## 0) Prerequisites (VM + Local)

### VM prerequisites (minimum for MVP)

- Ubuntu 22.04 VM with public reachability
- Node.js **20+** and npm
- PostgreSQL
- Redis

### Local prerequisites (optional)

- Node.js **20+** and npm for local UI preview

---

## Iteration 1: Project Skeleton & First Demo Page

### Goal

Establish a runnable skeleton and a UI that can be demonstrated early (even without backend).

### Deliverables

- `apps/web`: Vite + React + TS app, basic layout (header + canvas page)
- `apps/api`: Fastify API with `GET /healthz`
- `apps/worker`: BullMQ worker skeleton (queue wiring)
- `packages/shared`: shared types (Topology/Analysis/AI payloads)
- `README.md`: high-level run instructions and seeded logins (when backend is enabled)

### Verification

- Frontend builds and shows the canvas layout.
- API returns `{"ok":true}` at `/healthz` (when API is started).

### Rollback

- Remove the app folders to return to a clean workspace.

---

## Iteration 2: Canvas UI & Local State (No Backend Dependency)

### Goal

Implement an interactive topology canvas and local state management.

### Deliverables

- Canvas page layout:
  - Device palette (left)
  - Topology canvas (center)
  - Analytics panel (right)
  - AI prompt bar (top)
- React Flow interactions:
  - add/move/delete nodes
  - connect edges
  - zoom/pan
- Zustand store for nodes/edges

### Verification

- Smooth add/drag/connect/delete operations.
- State is consistent within the session.

---

## Iteration 3: Analysis API & Debounced Frontend Integration

### Goal

Connect canvas changes to a backend analysis endpoint using heuristic formulas.

### Deliverables

- Backend: `POST /api/analysis`
  - **Input**: Topology JSON (+ optional parameters)
  - **Output**: KPI summary (annual generation / CO₂ savings / trees) + 5/10-year cost series + simple payback estimate
- Frontend:
  - Debounced analysis hook (1–2 seconds)
  - Analytics panel showing KPIs and cost chart

### Verification

- API calls are debounced (no request spam while dragging).
- Defaults are applied when optional params are missing.

---

## Iteration 4: Authentication & Seeded Test Accounts (No Registration Needed)

### Goal

Ensure testers can access the system immediately using provided logins.

### Deliverables

- Backend:
  - `POST /api/auth/login` (returns JWT)
  - `GET /api/me`
  - Prisma schema for `User` + seed script creating **staff/customer** accounts
- Frontend:
  - Login page (or a “local preview” bypass for development)
  - Token storage and logout

### Verification

- Seeded credentials can log in successfully.
- No registration required for testing.

---

## Iteration 5: Async AI Layout (Redis + BullMQ)

### Goal

Generate a topology from natural language via an async job and render it on the canvas.

### Deliverables

- Backend:
  - `POST /api/ai/layout` → enqueue job, return `taskId`
  - `GET /api/ai/layout/:taskId` → poll state/result
- Worker:
  - LLM call via OpenAI-compatible HTTP API (configured with env vars)
  - Strict JSON schema validation
  - **Fallback** heuristic layout when API key is missing or the model output is invalid
- Frontend:
  - Prompt submission
  - Polling until completed
  - Apply returned nodes/edges to canvas

### Verification

- End-to-end: Submit → Poll → Render works.
- Works even without API key (fallback layout).

---

## Iteration 6: Async Report Generation (PDF Download)

### Goal

Generate and download a PDF report that consolidates topology, device list, and KPIs.

### Deliverables

- Backend:
  - `POST /api/reports` → enqueue report job, return `taskId`
  - `GET /api/reports/:taskId` → poll and return download URL when ready
  - `GET /api/reports/download/:reportId` → download PDF
- Worker:
  - HTML template rendering + Playwright PDF output
  - Stores PDF under a configured directory
- Frontend:
  - “Generate Report (PDF)” button
  - Poll progress and trigger download

### Verification (Minimum vs Stretch)

- **Minimum**: PDF contains cover/header, topology snapshot (SVG/placeholder), device list table, KPI numbers.
- **Stretch**: Include charts/figures in the PDF.

---

## Iteration 7 (Optional): Containerization (Docker Compose)

### Goal

Provide a single-command demo/deployment environment **if Docker is permitted** on the VM.

### Deliverables

- `docker-compose.yml` for:
  - web/api/worker
  - redis
  - postgres

### Verification

- `docker compose up --build` runs the full stack.

### Notes

- If Docker is not allowed, we deploy via **systemd** or manual process startup with full instructions.

---

## Iteration 8: Configuration, Hardening & Polish

### Goal

Improve usability and robustness for non-technical testers.

### Deliverables

- Config UI (tariffs, load, emission factor, PV assumptions)
- Better error handling, loading states, retries
- Operational docs: recovery after disconnect, logs, restart steps

### Verification

- Non-technical user can adjust key parameters and see analysis updates.

---

## Execution Strategy (How we avoid risk)

1. **Always runnable**: each iteration ends with a runnable demo.
2. **Closed loop first**: canvas → analysis → report (minimum) before improving model accuracy.
3. **Stable contracts**: keep request/response contracts stable to reduce integration churn.
4. **Remote testing readiness**: maintain a testing checklist, public URL, and seeded logins throughout.
5. **Fallbacks**: AI layout must work with or without an API key (heuristic fallback).

---

## Testing Access (for Overleaf / TA)

- **URL**: `http://<VM_PUBLIC_IP>:8080`
- **Seeded logins** (example):
  - `staff@gp16.local` / `Staff123!`
  - `customer@gp16.local` / `Customer123!`

