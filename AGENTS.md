# AGENTS.md — MikrotikIntegration

## Structure

- `backend/` — Express.js (Node, port 3001). Entry: `src/index.js`.
- `front-end/` — Create React App + TypeScript chat UI (port 3000) that queries an external API by `api_key`. Entry: `src/App.tsx`, `src/Queue.tsx` (current code shows MikroTik data tables; expected to become a chat interface).
- Root `package.json` has a stale Next.js dep (`yarn.lock`) — ignore, not actually used.

## Commands

| What | Directory | Command |
|------|-----------|---------|
| Start backend | `backend/` | `npm start` (runs `nodemon src/index.js`) |
| Start front-end | `front-end/` | `npm start` (port 3000, proxyless) |
| Test front-end | `front-end/` | `npm test` (CRA Jest, watch mode) |
| Build front-end | `front-end/` | `npm run build` (output: `build/`) |

Dependencies must be installed per-package: `npm install` in `backend/` and `front-end/`. Backend has no `node_modules` yet.

## Backend quirks

- Requires a live MikroTik RouterOS device at **192.168.37.1:8728** (API port).
- **Hardcoded credentials** in `src/services/index.js:9` — `admin` / `q1w2e3r4/*/*`.
- Routes: `GET /interface` (`/ip/address/print`), `GET /queue` (`/queue/simple/print`), `GET /`.
- The require path `../lib/mikronode/dist/mikronode` in `src/services/index.js` points to an empty dir — the real dep is the `mikronode` npm package v2.3.11 (from `package.json`). If the app fails to start, this path likely needs fixing to `mikronode`.

## Front-end quirks

- `App.test.tsx` asserts "learn react" text — the actual `App.tsx` no longer contains that string, so the test **will fail**.
- Hardcoded backend URL `http://localhost:3001` in `App.tsx:24` and `Queue.tsx:25`.
- No lint script; CRA's built-in ESLint runs via `react-scripts start`/`build`.

## Missing

- No CI, Docker, lint/typecheck/format scripts, or pre-commit hooks.
- No database — everything comes from the live RouterOS device.
