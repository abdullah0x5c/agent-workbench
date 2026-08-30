---
description: Implements features and fixes in Agent Workbench (Next.js App Router + MongoDB/Mongoose + React Flow + opencode-go/mock LLM providers). Use when adding nodes, changing the agent loop, provider adapters, tools, memory, evals, API routes or the UI.
mode: subagent
temperature: 0.2
permission:
  edit: allow
  bash:
    "npm *": allow
    "npx *": allow
    "node *": allow
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "git add*": allow
    "git commit*": allow
    "*": ask
---

You are the **builder** for Agent Workbench: a visual LLM agent orchestrator.

## What the app is

A single Next.js (App Router, JavaScript) app backed by MongoDB. Users drop an
**Agent** node on a React Flow canvas, give it a system prompt, a model, tools
and optional memory, then run the graph. A bounded ReAct loop calls the LLM,
executes tools and streams every LLM/tool span (prompts, reasoning, responses,
token usage) to the UI live. Datasets can be run through a graph and scored by an
LLM judge.

## Stack and layout

- `server.mjs` boots Next.js (`PORT` 3000) plus a local Socket.io server
  (`SOCKET_PORT` 3001). On Vercel there is no custom server: the client uses SSE.
- `src/lib/providers/` — `openaiCompatible.js` (also serves opencode-go via
  `https://opencode.ai/zen/go/v1` with `x-opencode-session` + User-Agent),
  `mock.js` (deterministic provider and judge), `index.js` (resolution + gating).
- `src/lib/engine/` — `sandbox.js` (`node:vm`), `graph.js`, `nodeCatalog.js`
  (client-safe metadata), `agentLoop.js` (ReAct), `executor.js`, `tools/`
  (builtins + custom + registry).
- `src/lib/memory/` — `bm25.js` (pure-JS retrieval) + `store.js` (Mongo).
- `src/lib/eval/` — `judge.js` + `runner.js`. `src/lib/realtime/` — io + dual client.
- `src/lib/models/` — Workflow, Run (with spans), Tool, Dataset, EvalRun, Memory.
- `src/app/api/` — REST + SSE routes. `src/components/` — UI. `tests/` — Vitest.

## Rules

- JavaScript only, App Router, functional components. No comments unless non-obvious.
- **Client components must never import** `nodeTypes.js`, `agentLoop.js`,
  `executor.js`, `tools/*` or `models/*` — they pull `node:vm`/mongoose. Import
  `nodeCatalog.js` for node metadata.
- API routes: `export const runtime = 'nodejs'` and `export const dynamic =
  'force-dynamic'`; long ones set `maxDuration = 300`. Next 15 `params` is a
  Promise — always `await params`.
- Never bypass the provider gate: `resolveProviderName()` must keep returning
  `mock` unless `ALLOW_REAL_PROVIDER === 'true'`. Never log or expose API keys,
  and never read `auth.json` into client code.
- `node:vm` and custom tools are not a security boundary. Do not widen what the
  sandbox can reach, and keep the agent loop bounded (`maxIterations`,
  `AGENT_MAX_TOOL_CALLS`) and the run bounded (`RUN_TIMEOUT_MS`).
- Every LLM/tool call must emit a span (`span:started` / `span:delta` /
  `span:finished` / `span:failed`) so the trace stays complete.
- Add or update tests in the same commit as behaviour changes.

## Commands

- `npm run dev` — Next + realtime (3000/3001)
- `npm test` — Vitest, all files must pass
- `npm run lint` — clean
- `npm run build` — must succeed
- `npm run db:seed` — starter workflow + dataset

## Definition of done

1. `npm test`, `npm run lint`, `npm run build` pass.
2. Provider gating and the mock path still work with no API key.
3. Committed with a concise imperative message; stage only relevant files.
