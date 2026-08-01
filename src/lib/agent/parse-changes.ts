import { nanoid } from "nanoid";
import { buildDiff } from "../diff";
import type { ProposedChange } from "../types";

/**
 * Extract ```devforge-change``` blocks from agent markdown.
 * Format:
 * path: foo.ts
 * kind: modify
 * description: fix typo
 * ---
 * file body
 */
export function parseProposedChanges(
  content: string,
  getOriginal: (path: string) => string
): ProposedChange[] {
  const changes: ProposedChange[] = [];
  const re = /```devforge-change\s*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const block = match[1];
    const sep = block.indexOf("\n---\n");
    const header = sep >= 0 ? block.slice(0, sep) : block;
    const body = sep >= 0 ? block.slice(sep + 5).replace(/\n$/, "") : "";

    const meta: Record<string, string> = {};
    for (const line of header.split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
    }

    const path = meta.path;
    if (!path) continue;

    const kind = (meta.kind as ProposedChange["kind"]) || "modify";
    const description = meta.description || `Update ${path}`;
    const originalContent = kind === "create" ? "" : getOriginal(path);
    const proposedContent = kind === "delete" ? "" : body;

    changes.push({
      id: nanoid(),
      path,
      description,
      kind,
      originalContent,
      proposedContent,
      status: "pending",
      diff: buildDiff(originalContent, proposedContent),
    });
  }

  return changes;
}

/** Strip machine blocks from display-friendly chat text (optional). */
export function stripChangeBlocks(content: string): string {
  return content
    .replace(/```devforge-change\s*\n[\s\S]*?```/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
