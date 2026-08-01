import type { ProjectFile } from "../types";
import { languageFromPath } from "../utils";

/** Stable ids so SSR / first paint stay deterministic when not hydrated from storage. */
function stableId(path: string): string {
  return `sample:${path}`;
}

function file(path: string, content: string): ProjectFile {
  const name = path.split("/").pop()!;
  return {
    id: stableId(path),
    name,
    path,
    type: "file",
    content,
    language: languageFromPath(path),
  };
}

function folder(path: string, children: ProjectFile[]): ProjectFile {
  const name = path.split("/").pop()!;
  return {
    id: stableId(path),
    name,
    path,
    type: "folder",
    children,
  };
}

/**
 * Demo project used when no real workspace is connected.
 * Intentionally includes a small bug so Debug mode is immediately useful.
 */
export function createSampleProject(): ProjectFile[] {
  return [
    file(
      "README.md",
      `# TaskFlow API

A minimal Node.js + TypeScript task API for demonstrating **DevForge**.

## Setup

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

## Scripts

- \`npm run dev\` — start the API
- \`npm test\` — run unit tests
- \`npm run build\` — compile TypeScript
`
    ),
    file(
      "package.json",
      JSON.stringify(
        {
          name: "taskflow-api",
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            dev: "tsx watch src/index.ts",
            build: "tsc",
            start: "node dist/index.js",
            test: "node --import tsx --test src/**/*.test.ts",
          },
          dependencies: {
            express: "^4.21.0",
            zod: "^3.23.8",
          },
          devDependencies: {
            "@types/express": "^4.17.21",
            "@types/node": "^20.14.0",
            tsx: "^4.19.0",
            typescript: "^5.5.0",
          },
        },
        null,
        2
      )
    ),
    file(
      "tsconfig.json",
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            outDir: "dist",
            rootDir: "src",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ["src/**/*"],
        },
        null,
        2
      )
    ),
    file(
      ".env.example",
      `PORT=3001
DATABASE_URL=your_database_url_here
# Never commit real secrets. Use placeholders only.
API_KEY=your_api_key_here
`
    ),
    file(
      ".gitignore",
      `node_modules/
dist/
.env
.DS_Store
*.log
`
    ),
    folder("src", [
      file(
        "src/index.ts",
        `import express from "express";
import { taskRouter } from "./routes/tasks.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(express.json());
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "taskflow-api" });
});

app.use("/tasks", taskRouter);
app.use(errorHandler);

app.listen(port, () => {
  console.log(\`TaskFlow listening on http://localhost:\${port}\`);
});
`
      ),
      file(
        "src/types.ts",
        `export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
}
`
      ),
      file(
        "src/store.ts",
        `import type { Task } from "./types.js";
import { randomUUID } from "node:crypto";

const tasks = new Map<string, Task>();

export function listTasks(): Task[] {
  return Array.from(tasks.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
}

export function createTask(title: string): Task {
  const task: Task = {
    id: randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  tasks.set(task.id, task);
  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function toggleTask(id: string): Task | undefined {
  const task = tasks.get(id);
  if (!task) return undefined;
  const updated = { ...task, completed: !task.completed };
  tasks.set(id, updated);
  return updated;
}

export function deleteTask(id: string): boolean {
  return tasks.delete(id);
}
`
      ),
      folder("src/routes", [
        file(
          "src/routes/tasks.ts",
          `import { Router } from "express";
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
`
        ),
      ]),
      folder("src/middleware", [
        file(
          "src/middleware/errorHandler.ts",
          `import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    message: err instanceof Error ? err.message : "Unknown error",
  });
};
`
        ),
      ]),
      file(
        "src/store.test.ts",
        `import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTask, listTasks, toggleTask } from "./store.js";

describe("task store", () => {
  it("creates a task with a title", () => {
    const task = createTask("Ship DevForge");
    assert.equal(task.title, "Ship DevForge");
    assert.equal(task.completed, false);
  });

  it("lists created tasks", () => {
    createTask("A");
    const all = listTasks();
    assert.ok(all.length >= 1);
  });

  it("toggles completion", () => {
    const task = createTask("Toggle me");
    const updated = toggleTask(task.id);
    assert.equal(updated?.completed, true);
  });
});
`
      ),
    ]),
  ];
}

export const SAMPLE_PROJECT_NAME = "taskflow-api";

export const WELCOME_MESSAGE =
  "Tell me what you are building, paste an error, or open a project file. I will help you make the smallest correct change and verify that it works.";

export const SAMPLE_ERROR_LOG = `TypeError: Cannot read properties of undefined (reading 'trim')
    at createTask (src/store.ts:18:15)
    at <anonymous> (src/routes/tasks.ts:24:16)
    at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)

POST /tasks 500 4.128 ms - 78
`;
