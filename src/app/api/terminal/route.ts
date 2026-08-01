import { NextResponse } from "next/server";
import type { ProjectFile } from "@/lib/types";
import { analyzeCommand } from "@/lib/terminal/safety";
import { syncProjectToDisk } from "@/lib/terminal/workspace-sync";
import { executeRealCommand } from "@/lib/terminal/real-executor";
import { executeMockCommand } from "@/lib/terminal/mock-executor";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  command?: string;
  confirmed?: boolean;
  sessionId?: string;
  rootName?: string;
  files?: ProjectFile[];
  /** Force mock (default: real local shell) */
  mode?: "real" | "mock";
};

/**
 * POST /api/terminal
 * Default: real local shell in a per-session workspace directory.
 * Syncs the browser project tree to disk, then runs the command with cwd locked there.
 * Set DEVFORGE_TERMINAL_MODE=mock to use the old simulator.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const command = body.command?.trim();
    if (!command) {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }

    const mode =
      body.mode ||
      (process.env.DEVFORGE_TERMINAL_MODE === "mock" ? "mock" : "real");

    if (mode === "mock") {
      const analysis = analyzeCommand(command);
      if (analysis.hardBlocked) {
        return NextResponse.json({
          requiresConfirmation: false,
          hardBlocked: true,
          confirmationReason: analysis.reason,
          mocked: true,
          entry: null,
          error: analysis.reason,
        });
      }
      if (analysis.requiresConfirmation && !body.confirmed) {
        return NextResponse.json({
          requiresConfirmation: true,
          confirmationReason: analysis.reason,
          mocked: true,
          entry: null,
        });
      }
      const result = await executeMockCommand(command, {
        confirmed: body.confirmed,
      });
      return NextResponse.json({
        requiresConfirmation: result.requiresConfirmation,
        confirmationReason: result.confirmationReason,
        mocked: true,
        entry: result.entry,
        notice: "MOCK TERMINAL — simulated output only.",
      });
    }

    // --- Real terminal ---
    const analysis = analyzeCommand(command);
    if (analysis.hardBlocked) {
      return NextResponse.json({
        requiresConfirmation: false,
        hardBlocked: true,
        confirmationReason: analysis.reason,
        mocked: false,
        entry: null,
        error: analysis.reason,
      });
    }

    if (analysis.requiresConfirmation && !body.confirmed) {
      return NextResponse.json({
        requiresConfirmation: true,
        confirmationReason: analysis.reason,
        mocked: false,
        entry: null,
      });
    }

    if (!body.files || !Array.isArray(body.files)) {
      return NextResponse.json(
        { error: "files[] is required for real terminal (project sync)" },
        { status: 400 }
      );
    }

    const sessionId = body.sessionId || "default";
    const rootName = body.rootName || "project";

    const { cwd, fileCount } = await syncProjectToDisk({
      sessionId,
      rootName,
      files: body.files,
    });

    const result = await executeRealCommand({
      command,
      cwd,
      confirmed: body.confirmed,
    });

    // Prepend sync info
    if (result.entry && !result.requiresConfirmation) {
      result.entry.lines = [
        {
          id: `sync-${Date.now()}`,
          level: "info",
          text: `Synced ${fileCount} project file(s) → disk before run.`,
          timestamp: Date.now(),
        },
        ...result.entry.lines,
      ];
    }

    return NextResponse.json({
      requiresConfirmation: result.requiresConfirmation,
      confirmationReason: result.confirmationReason,
      hardBlocked: result.hardBlocked ?? false,
      mocked: false,
      cwd,
      entry: result.entry,
      notice:
        "REAL TERMINAL — commands run on this machine inside the DevForge workspace directory. Not a full OS sandbox.",
    });
  } catch (err) {
    console.error("[api/terminal]", err);
    const message = err instanceof Error ? err.message : "Terminal error";
    return NextResponse.json({ error: message, mocked: false }, { status: 500 });
  }
}
