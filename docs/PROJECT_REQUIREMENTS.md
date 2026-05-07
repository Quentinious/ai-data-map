# PROJECT_REQUIREMENTS.md — ai-data-map

This document describes the course quality requirements and how each is satisfied in this project.

---

## Levels Overview

| Level | Course grade | Description |
|-------|--------------|-------------|
| **3** | Удовлетворительно | Baseline: working code, basic README, runs locally |
| **4** | Хорошо | Engineering quality: templates, linting, tests, CI, Docker |
| **5** | Отлично | Production-ready: load tests, Postman, docs, dependabot, observability |

---

## Level 3 — Удовлетворительно / Baseline ✅

### Requirements
- Working backend API with domain logic
- Working frontend application
- Basic README with run instructions

### Implementation
- **Backend** (`apps/backend`): Express + TypeScript API with `/health`, `/api/areas`, `/api/listings`, `/v1/areas/:id/snapshot`, `/v1/map/districts`, `/v1/map/listings`, `/v1/ai/summary`
- **Frontend** (`apps/frontend`): Vite + React + react-leaflet choropleth map, right-side panel with Top-5, AI summary
- **README**: run instructions, API reference, data pipeline, env vars, AI configuration

---

## Level 4 — Хорошо / Engineering Quality ✅

### 4.1 GitHub Issue Templates

Located in `.github/ISSUE_TEMPLATE/`:

| File | Purpose |
|------|---------|
| `epic.md` | Large initiative spanning multiple tasks |
| `feature.md` | User-facing feature or significant enhancement |
| `task.md` | Concrete development, refactoring, or chore |

Each template includes: Description, Scope, Acceptance Criteria, Self-check checklist, Estimate, Assignee, Dependencies, Testing notes.

### 4.2 Pull Request Template

`.github/PULL_REQUEST_TEMPLATE.md` — checklist covering:
- Issue linked
- `typecheck` / `test` / `lint` / `build` pass
- Docs updated
- No secrets committed
- API changes documented

### 4.3 ESLint

Root `eslint.config.mjs` (flat config) applies `typescript-eslint/recommended` rules to:
- `apps/backend/src/**`
- `apps/frontend/src/**`
- `tools/**`

Scripts:
```bash
npm run lint         # Check for issues
npm run lint:fix     # Auto-fix where possible
```

Rules: `no-explicit-any` (warn), `no-unused-vars` (warn with `_` prefix exception), `no-console` (off — backend uses console for structured logging).

### 4.4 Vitest Unit Tests

Located in `apps/backend/src/`:

| Test File | Coverage |
|-----------|---------|
| `services/statsHelpers.test.ts` | `sortedNumbers`, `percentile`, `median`, `computeStats` |
| `services/loadListings.test.ts` | Filter logic for districtId, rooms, area, price, userType |
| `routes/v1/ai.test.ts` | Template summary text, `formatPrice`, districtId validation |

Run:
```bash
npm run test
```

### 4.5 CI Workflow

`.github/workflows/ci.yml` — runs on push to `main` and on every pull request:
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (Node 20, npm cache)
3. `npm ci`
4. `npm run typecheck`
5. `npm run lint`
6. `npm run test`
7. `npm run build`

### 4.6 Dependabot

`.github/dependabot.yml` — weekly npm updates targeting `main`, minor/patch grouped into a single PR.

---

## Level 5 — Отлично / Production-Ready ✅

### 5.1 Postman Collection

Located in `docs/postman/`:

| File | Description |
|------|-------------|
| `ai-data-map.postman_collection.json` | 7 requests covering all public endpoints |
| `local.postman_environment.json` | Local env: `baseUrl`, `districtId`, filter vars |

**Import into Postman:**
1. Open Postman → Import → `ai-data-map.postman_collection.json`
2. Import → `local.postman_environment.json`
3. Select "ai-data-map — Local" environment
4. Run requests

### 5.2 Docker

| File | Description |
|------|-------------|
| `apps/backend/Dockerfile` | Multi-stage build: TypeScript → Node production |
| `apps/frontend/Dockerfile` | Vite build → nginx serving on port 5173 |
| `apps/frontend/nginx.conf` | SPA fallback routing |
| `docker-compose.yml` | Orchestrates backend (4000) + frontend (5173) |
| `.dockerignore` | Excludes `node_modules`, `dist`, `.env` files |

**Run with Docker Compose:**
```bash
# Create apps/backend/.env first (copy from .env.example)
docker compose up --build
```

Secrets: passed via `env_file` referencing `apps/backend/.env` which is git-ignored.  
**Never bake API keys into images.**

### 5.3 Load Tests (k6)

Located in `tests/load/`:

| Script | Target |
|--------|--------|
| `map-districts.k6.js` | `GET /v1/map/districts` — 5 VUs, 20s, p95 < 500ms |
| `ai-summary.k6.js` | `POST /v1/ai/summary` — 3 VUs, 20s, p95 < 3s |

**Install k6:** https://k6.io/docs/getting-started/installation/

**Run:**
```bash
npm run load:test:map
npm run load:test:ai

# Custom params
k6 run --vus 10 --duration 60s tests/load/map-districts.k6.js
k6 run --env BASE_URL=http://127.0.0.1:4000 tests/load/ai-summary.k6.js
```

### 5.4 README Updates

`README.md` extended with:
- Quality checks section (typecheck, lint, test, build)
- Postman usage
- Docker usage
- Load testing usage
- Git workflow / PR process
- GigaChat troubleshooting and reason codes

---

## Reason Codes Reference

When `POST /v1/ai/summary` falls back to template summary, the `reason` field explains why:

| Code | Meaning |
|------|---------|
| `disabled_flag` | `AI_SUMMARY_ENABLED` is not `true` |
| `missing_api_key` | Provider configured but credentials missing |
| `provider_error_missing_credentials` | Provider-specific key/model env var not set |
| `provider_error_tls` | TLS/SSL handshake failure (network issue) |
| `provider_error_auth` | Authentication rejected by provider (401/403) |
| `provider_error_auth_bad_request` | OAuth or auth request rejected with 400 |
| `provider_error_chat` | Chat completion request failed (GigaChat) |
| `provider_error_network` | Network timeout or connection refused |
| `provider_error_unsupported_region` | Provider returns 403 `unsupported_country_region_territory` |
| `template_fallback` | General error — template used as fallback |
| `error` | Unexpected error not matching known codes |

---

## Adaptation Notes

This project is a **Novosibirsk housing market analysis tool** rather than a generic country-data app. The following adaptations were made:

- "Country" concept → "District" (Novosibirsk districts)
- WorldBank / OpenWeather integrations → not used in main flow; retained as legacy endpoints
- Primary data source: `listings.sample.json` (synthetic) or user-supplied `listings.real.json` (via rest-app.net export)
- AI summary: generates district market analysis in Russian rather than country economic summary
- Map: react-leaflet choropleth on GeoJSON district polygons
