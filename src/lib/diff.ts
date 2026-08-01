import { diffLines } from "diff";
import type { DiffLine } from "./types";

/** Build a side-by-side-friendly unified diff for the Changes panel. */
export function buildDiff(original: string, proposed: string): DiffLine[] {
  const parts = diffLines(original, proposed);
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (const part of parts) {
    const chunkLines = part.value.replace(/\n$/, "").split("\n");
    // empty trailing from split on final newline
    if (part.value.endsWith("\n") && chunkLines[chunkLines.length - 1] === "") {
      chunkLines.pop();
    }
    if (chunkLines.length === 1 && chunkLines[0] === "" && !part.added && !part.removed) {
      continue;
    }

    for (const line of chunkLines) {
      if (part.added) {
        lines.push({ type: "add", content: line, newLineNumber: newLine++ });
      } else if (part.removed) {
        lines.push({ type: "remove", content: line, oldLineNumber: oldLine++ });
      } else {
        lines.push({
          type: "context",
          content: line,
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
        });
      }
    }
  }

  return lines;
}

/** Compute 1-based line numbers that differ between two versions. */
export function changedLineNumbers(original: string, proposed: string): number[] {
  const diff = buildDiff(original, proposed);
  const set = new Set<number>();
  for (const line of diff) {
    if (line.type === "add" && line.newLineNumber != null) {
      set.add(line.newLineNumber);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}
