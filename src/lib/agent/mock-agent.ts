import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentMode,
  ProposedChange,
} from "../types";
import { buildDiff } from "../diff";
import { nanoid } from "nanoid";
import { parseProposedChanges } from "./parse-changes";

/**
 * Local mock agent used when XAI_API_KEY is not configured.
 * Produces realistic, mode-aware responses and labeled as mocked.
 */
export async function runMockAgent(
  req: AgentChatRequest
): Promise<AgentChatResponse> {
  // Simulate thinking latency
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

  const lastUser =
    [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase();
  const active = req.projectContext.activeFile;

  let content = "";

  switch (req.mode) {
    case "debug":
      content = mockDebug(lower, lastUser, active?.path, active?.content);
      break;
    case "build":
      content = mockBuild(lastUser);
      break;
    case "review":
      content = mockReview(active?.path, active?.content);
      break;
    case "explain":
      content = mockExplain(
        req.explainLevel ?? "beginner",
        active?.path,
        active?.content
      );
      break;
    case "test":
      content = mockTest(active?.path);
      break;
    default:
      content = mockDebug(lower, lastUser, active?.path, active?.content);
  }

  const getOriginal = (path: string) => {
    if (active?.path === path) return active.content;
    return "";
  };

  let proposedChanges = parseProposedChanges(content, getOriginal);

  // Ensure debug mock always has a change if bug is present
  if (
    req.mode === "debug" &&
    proposedChanges.length === 0 &&
    (lower.includes("error") ||
      lower.includes("bug") ||
      lower.includes("fix") ||
      lower.includes("titel") ||
      lastUser.includes("Cannot read"))
  ) {
    proposedChanges = [demoTaskRouteFix()];
    content +=
      "\n\n" +
      formatChangeBlock(
        "src/routes/tasks.ts",
        "modify",
        "Fix typo: titel → title",
        FIXED_TASKS_ROUTE
      );
    proposedChanges = parseProposedChanges(content, () => DEMO_TASKS_ROUTE);
  }

  return {
    content,
    proposedChanges,
    mocked: true,
    model: "devforge-mock-v1",
  };
}

function formatChangeBlock(
  path: string,
  kind: string,
  description: string,
  body: string
): string {
  return `\`\`\`devforge-change
path: ${path}
kind: ${kind}
description: ${description}
---
${body}
\`\`\``;
}

const DEMO_TASKS_ROUTE = `import { Router } from "express";
import { z } from "zod";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  toggleTask,
} from "../store.js";

export const taskRouter = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
});

taskRouter.get("/", (_req, res) => {
  res.json(listTasks());
});

taskRouter.post("/", (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  // BUG (intentional demo): uses wrong property name — should be parsed.data.title
  const task = createTask(parsed.data.titel as string);
  res.status(201).json(task);
});

taskRouter.get("/:id", (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

taskRouter.patch("/:id/toggle", (req, res) => {
  const task = toggleTask(req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

taskRouter.delete("/:id", (req, res) => {
  const ok = deleteTask(req.params.id);
  if (!ok) return res.status(404).json({ error: "Task not found" });
  res.status(204).send();
});
`;

const FIXED_TASKS_ROUTE = DEMO_TASKS_ROUTE.replace(
  `  // BUG (intentional demo): uses wrong property name — should be parsed.data.title
  const task = createTask(parsed.data.titel as string);`,
  `  const task = createTask(parsed.data.title);`
);

function demoTaskRouteFix(): ProposedChange {
  return {
    id: nanoid(),
    path: "src/routes/tasks.ts",
    description: "Fix typo: titel → title",
    kind: "modify",
    originalContent: DEMO_TASKS_ROUTE,
    proposedContent: FIXED_TASKS_ROUTE,
    status: "pending",
    diff: buildDiff(DEMO_TASKS_ROUTE, FIXED_TASKS_ROUTE),
  };
}

function mockDebug(
  lower: string,
  raw: string,
  path?: string,
  content?: string
): string {
  const hasTitelBug =
    content?.includes("parsed.data.titel") ||
    lower.includes("titel") ||
    raw.includes("Cannot read properties of undefined") ||
    lower.includes("error") ||
    lower.includes("bug") ||
    lower.includes("500");

  if (hasTitelBug) {
    return `**Problem detected**
\`POST /tasks\` crashes with \`TypeError: Cannot read properties of undefined (reading 'trim')\` (or returns a task with an undefined title) because the handler reads the wrong property from validated input.

**Most likely cause**
In \`src/routes/tasks.ts\`, the create handler uses \`parsed.data.titel\` (typo) instead of \`parsed.data.title\`. Zod validates \`title\`, so \`titel\` is always \`undefined\`.

**File to open**
\`src/routes/tasks.ts\` — inside the \`POST /\` handler, the \`createTask(...)\` call.

**Change**
Replace:
\`\`\`ts
const task = createTask(parsed.data.titel as string);
\`\`\`
with:
\`\`\`ts
const task = createTask(parsed.data.title);
\`\`\`
Also remove the intentional bug comment once fixed.

${formatChangeBlock(
  "src/routes/tasks.ts",
  "modify",
  "Fix property typo titel → title",
  FIXED_TASKS_ROUTE
)}

**Run**
\`\`\`bash
npm test
\`\`\`
Then (after starting the API):
\`\`\`bash
curl -s -X POST http://localhost:3001/tasks -H 'Content-Type: application/json' -d '{"title":"Ship DevForge"}'
\`\`\`

**Expected result**
Tests pass. The POST returns JSON with \`"title":"Ship DevForge"\` and HTTP 201 — not a 500.

> **Mocked agent:** This response was generated locally without an external model. Set \`XAI_API_KEY\` for live SpaceXAI (xAI) replies.
`;
  }

  return `**Problem detected**
I do not yet have enough signal to pin a root cause from: “${raw.slice(0, 120)}${raw.length > 120 ? "…" : ""}”.

**Most likely cause**
Insufficient context — this is an assumption, not a confirmed diagnosis.

**File to open**
${path ? `\`${path}\` (currently open)` : "Paste the stack trace or open the failing file."}

**Change**
None yet. Please share:
1. The exact error message / stack trace  
2. The command you ran  
3. The file path if you know it  

**Run**
Re-run the failing command and paste the full output into chat.

**Expected result**
With the real error text I can rank causes and propose the smallest safe fix.

> **Mocked agent:** Local fallback. Configure \`XAI_API_KEY\` for full model responses.
`;
}

function mockBuild(user: string): string {
  const idea = user.trim() || "a small REST API";
  return `## Build plan (MVP)

**Product:** ${idea}

**Assumptions:** TypeScript + Node (Express), in-memory store for v1, REST only, no auth yet.

### Stack
- Runtime: Node.js + TypeScript  
- HTTP: Express  
- Validation: Zod  
- Tests: node:test  

### Folder structure
\`\`\`
my-app/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts
    ├── routes/
    └── store.ts
\`\`\`

### Next step (only this for now)
Confirm the stack, or tell me a different one (Next.js, FastAPI, etc.). After you confirm, I will generate files one batch at a time via the Changes panel.

### Setup (after files exist)
\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

### Deployment
High-level only: deploy to Vercel (Node) or a Docker host. I will not claim a deploy succeeded until a real provider confirms it.

> **Mocked agent:** Scaffolding is illustrative. Live SpaceXAI can generate full multi-file projects when \`XAI_API_KEY\` is set.
`;
}

function mockReview(path?: string, content?: string): string {
  const findings: string[] = [];

  if (content?.includes("titel")) {
    findings.push(
      "**Critical — Bug:** `parsed.data.titel` typo will pass `undefined` into `createTask` (`src/routes/tasks.ts`)."
    );
  }
  if (content?.includes("express") || path?.includes("index")) {
    findings.push(
      "**Medium — Security:** No rate limiting or request size caps on the JSON body parser."
    );
  }
  findings.push(
    "**Medium — Architecture:** In-memory `Map` store is fine for demos; production needs a real database and persistence."
  );
  findings.push(
    "**Low — Tests:** Expand coverage for 400 validation paths and 404 handlers."
  );
  findings.push(
    "**Low — Ops:** Add structured logging and a readiness probe beyond `/health`."
  );

  return `## Code review${path ? ` — \`${path}\`` : ""}

${findings.map((f, i) => `${i + 1}. ${f}`).join("\n\n")}

### Recommended next action
Fix the critical bug first (smallest change), then re-run tests. Switch to **Debug** mode or ask me to apply the title typo fix.

> **Mocked agent:** Heuristic review only. Live models perform deeper analysis with \`XAI_API_KEY\`.
`;
}

function mockExplain(
  level: string,
  path?: string,
  content?: string
): string {
  const target = path ?? "the open file";
  if (level === "line-by-line" && content) {
    const lines = content.split("\n").slice(0, 12);
    return `## Line-by-line — \`${target}\` (first lines)

${lines.map((l, i) => `**L${i + 1}:** \`${l || " "}\`\n${explainLine(l)}`).join("\n\n")}

_(Truncated for readability in mock mode.)_

> **Mocked agent** response.
`;
  }
  if (level === "architecture") {
    return `## Architecture overview

This sample **TaskFlow API** is a small layered Node service:

1. **Entry (\`src/index.ts\`)** — boots Express, mounts routes, registers error middleware.  
2. **Routes (\`src/routes/\`)** — HTTP boundary; validates input with Zod.  
3. **Store (\`src/store.ts\`)** — in-memory domain operations.  
4. **Types (\`src/types.ts\`)** — shared TypeScript contracts.

Data never leaves the process. Good for learning; not durable.

> **Mocked agent** response.
`;
  }
  if (level === "technical") {
    return `## Technical explanation — \`${target}\`

${content ? "The open file participates in the request path for task resources." : "Open a file for a precise technical walkthrough."}

- Express \`Router\` composes handlers under \`/tasks\`.  
- Zod \`safeParse\` returns a discriminated result; failure → 400 with flattened issues.  
- Store uses \`Map\` + \`randomUUID\` for O(1) lookups.

> **Mocked agent** response.
`;
  }
  return `## Beginner explanation — \`${target}\`

Think of this project like a tiny notebook for to-do items, exposed over the web:

- Someone sends a message (“create a task”) to the server.  
- The server checks the message is valid.  
- It saves the task in memory and replies with the saved item.

If a field name is misspelled in the code (like \`titel\` instead of \`title\`), the server looks for data that is not there and can crash.

> **Mocked agent** response.
`;
}

function explainLine(line: string): string {
  if (line.includes("import")) return "Loads a dependency or local module.";
  if (line.includes("Router")) return "Creates a mini app for related URLs.";
  if (line.includes("z.object")) return "Defines the shape of allowed request data.";
  if (line.includes("res.")) return "Sends an HTTP response to the client.";
  if (line.trim().startsWith("//")) return "A comment for humans; ignored at runtime.";
  if (!line.trim()) return "Blank line for readability.";
  return "Application logic on this line.";
}

function mockTest(path?: string): string {
  return `## Test plan

### Generated tests (not executed)
The sample project already includes \`src/store.test.ts\` covering create, list, and toggle.

Suggested additional cases (generate on request):
- POST \`/tasks\` with missing \`title\` → 400  
- POST \`/tasks\` with valid body → 201 and correct title  
- GET unknown id → 404  

### Run (when a real terminal is connected)
\`\`\`bash
npm test
\`\`\`

### Status
**No tests were executed in this reply.** Mock terminal can simulate \`npm test\` output if you run it from the Terminal panel — treat that as **simulated**, not a real CI result.

${path ? `Focused file: \`${path}\`` : ""}

> **Mocked agent:** Will not invent pass/fail results without command output.
`;
}

export function mockModeLabel(mode: AgentMode): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}
