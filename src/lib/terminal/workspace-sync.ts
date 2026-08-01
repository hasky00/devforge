import fs from "fs/promises";
import path from "path";
import type { ProjectFile } from "../types";

/**
 * Materialize the in-browser project tree onto disk so a real shell can run against it.
 * Workspace root: <app>/.devforge-workspace/<sessionId>/<rootName>/
 * Preserves node_modules and other untracked dirs between syncs.
 */

export function getWorkspaceRoot(): string {
  const custom = process.env.DEVFORGE_WORKSPACE_ROOT;
  if (custom) return path.resolve(custom);
  return path.join(process.cwd(), ".devforge-workspace");
}

function sanitizeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64) || "session";
}

export function resolveProjectDir(sessionId: string, rootName: string): string {
  return path.join(
    getWorkspaceRoot(),
    sanitizeSegment(sessionId),
    sanitizeSegment(rootName)
  );
}

/** Ensure path stays under base (no traversal). */
export function safeJoin(base: string, relativePath: string): string {
  const cleaned = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (cleaned.includes("\0") || cleaned.split("/").some((p) => p === "..")) {
    throw new Error(`Invalid path: ${relativePath}`);
  }
  const full = path.resolve(base, cleaned);
  const baseResolved = path.resolve(base);
  if (full !== baseResolved && !full.startsWith(baseResolved + path.sep)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }
  return full;
}

function flattenFiles(
  nodes: ProjectFile[],
  out: { path: string; content: string }[] = []
): { path: string; content: string }[] {
  for (const n of nodes) {
    if (n.type === "file") {
      out.push({ path: n.path, content: n.content ?? "" });
    } else if (n.children) {
      flattenFiles(n.children, out);
    }
  }
  return out;
}

export async function syncProjectToDisk(options: {
  sessionId: string;
  rootName: string;
  files: ProjectFile[];
}): Promise<{ cwd: string; fileCount: number }> {
  const cwd = resolveProjectDir(options.sessionId, options.rootName);
  await fs.mkdir(cwd, { recursive: true });

  const flat = flattenFiles(options.files);
  for (const file of flat) {
    const dest = safeJoin(cwd, file.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.content, "utf8");
  }

  return { cwd, fileCount: flat.length };
}
