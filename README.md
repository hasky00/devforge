# DevForge

**DevForge** is an AI developer agent workspace: a lightweight mix of IDE, terminal, code-review tool, and coding assistant. It helps you build, inspect, debug, and improve software with **smallest correct changes** and explicit verification.

> Default welcome: *Tell me what you are building, paste an error, or open a project file. I will help you make the smallest correct change and verify that it works.*

## Features (v0.1)

| Panel | What it does |
|--------|----------------|
| **Project** | File tree — create, rename, delete (delete requires confirmation) |
| **Editor** | Tabs, line numbers, save/copy, highlights lines changed by accepted patches |
| **Agent chat** | Build · Debug · Review · Explain · Test modes |
| **Terminal** | **Real shell** — local uses `.devforge-workspace/`; Vercel can use protected ephemeral `/tmp` execution |
| **Changes** | Unified diffs with Accept / Reject / Edit before applying |

### Agent modes

- **Build** — MVP plan, stack, structure, files, setup, tests, deploy notes  
- **Debug** — structured diagnosis (problem → cause → file → change → run → expected)  
- **Review** — bugs, security, architecture, a11y, tests  
- **Explain** — beginner / technical / line-by-line / architecture  
- **Test** — generates tests; **never invents results**

### Safety

- Confirms destructive actions (delete files, destructive shell patterns)  
- Placeholder secrets only (`your_api_key_here`)  
- Does not claim command success unless output confirms it  
- Mock agent is **clearly labeled** when no `XAI_API_KEY`
- Terminal is **real by default** locally; on Vercel set `DEVFORGE_TERMINAL_MODE=real` and `DEVFORGE_TERMINAL_TOKEN` for protected ephemeral `/tmp` execution, or set `DEVFORGE_TERMINAL_MODE=mock` to simulate

## Quick start

```bash
cd Projects/devforge   # or your clone path
npm install
cp .env.example .env   # optional: add XAI_API_KEY for live AI
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Live AI (SpaceXAI / xAI)

1. Create a key at [console.x.ai](https://console.x.ai)  
2. Set in `.env`:

```env
XAI_API_KEY=your_api_key_here
XAI_MODEL=grok-4.5
```

Without a key, the **local mock agent** answers with realistic, labeled responses (including a demo fix for the sample bug).

### Vercel terminal mode

Vercel does not provide a durable project filesystem. To run real commands there, DevForge syncs the browser project into ephemeral `/tmp` storage for each request. Enable it only for trusted users:

```env
DEVFORGE_TERMINAL_MODE=real
DEVFORGE_TERMINAL_TOKEN=choose_a_long_random_token
```

Enter the same token in the terminal panel when prompted. Leave `DEVFORGE_TERMINAL_MODE` unset, or set it to `mock`, if you want public demo-safe simulated output.

## Sample project

On first load you get **taskflow-api** — a small Express + TypeScript task API with an intentional bug:

```ts
// src/routes/tasks.ts — typo
createTask(parsed.data.titel as string)  // should be .title
```

**Try this:**

1. Mode: **Debug**  
2. Paste the pre-filled error log or type: `POST /tasks returns 500`  
3. Review the proposed fix in **Changes** → Accept  
4. Run `npm test` in the mock terminal  

Session state (files, chat, pending diffs) persists in `localStorage`.

## Architecture

```
src/
  app/
    api/chat/          # SpaceXAI or mock agent
    api/terminal/      # Real local/Vercel ephemeral terminal or mock terminal
  components/
    workspace/         # IDE panels
    ui/                # Button, Badge, ConfirmDialog
  lib/
    agent/             # System prompts, mock agent, change parsing
    project/           # Sample project, file-tree ops
    terminal/          # Real executor, mock executor, safety checks, workspace sync
    tech-registry.ts   # Pluggable language/framework list
    types.ts           # Domain types
  store/
    workspace-store.ts # Zustand + persist
```

### Extending later

| Integration | Plug-in point |
|-------------|----------------|
| Isolated sandbox (Docker/Vercel Sandbox) | Swap `lib/terminal/real-executor.ts` spawn for a remote sandbox |
| Mock terminal | `DEVFORGE_TERMINAL_MODE=mock` |
| Protected Vercel terminal | `DEVFORGE_TERMINAL_MODE=real` + `DEVFORGE_TERMINAL_TOKEN` |
| GitHub | New API routes; keep `ProjectFile` tree as the source of truth |
| More languages | Add entries in `lib/tech-registry.ts` |
| Multiple models | `XAI_MODEL` + adapter in `api/chat` |
| Deploy (Vercel) | Agent deploy instructions already structured; wire provider APIs separately |

### Proposed change format

The agent can emit machine-readable blocks (stripped from chat display, shown in Changes):

````markdown
```devforge-change
path: src/routes/tasks.ts
kind: modify
description: Fix title typo
---
<full file content after change>
```
````

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

## Supported technologies (v1)

JavaScript, TypeScript, React, Next.js, Node.js, Python, FastAPI, HTML, CSS, Tailwind, REST, WebSockets, SQLite, PostgreSQL, Git, GitHub, Docker, Vercel — see `src/lib/tech-registry.ts`.

## License

Private / your project terms. Built as a production-oriented first version for independent developers, founders, and learners.
