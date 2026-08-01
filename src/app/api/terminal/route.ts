import { NextResponse } from "next/server";
import type { ProjectFile } from "@/lib/types";
import { analyzeCommand } from "@/lib/terminal/safety";
import {
  isCloudRuntime,
  syncProjectToDisk,
} from "@/lib/terminal/workspace-sync";
import { executeRealCommand } from "@/lib/terminal/real-executor";
import { executeMockCommand } from "@/lib/terminal/mock-executor";

export const runtime = "nodejs";
export const maxDuration = 300;

type TerminalMode = "real" | "mock";

function getTerminalMode(): TerminalMode {
  const envMode = process.env.DEVFORGE_TERMINAL_MODE as
    | TerminalMode
    | undefined;
  if (envMode === "mock") return "mock";
  if (envMode === "real") return "real";
  return isCloudRuntime() ? "mock" : "real";
}

function verifyCloudTerminalToken(req: Request, bodyToken?: string): boolean {
  if (!isCloudRuntime()) return true;
  const expected = process.env.DEVFORGE_TERMINAL_TOKEN;
  if (!expected) return false;

  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : undefined;

  return (bodyToken || bearer) === expected;
}

/** GET /api/terminal — report whether this host runs a real shell or cloud mock. */
export async function GET() {
  const mode = getTerminalMode();
  const cloud = isCloudRuntime();
  return NextResponse.json({
    mode,
    cloud,
    tokenRequired: cloud && mode === "real",
    notice:
      mode === "mock"
        ? "Vercel serverless: terminal is simulated. Set DEVFORGE_TERMINAL_MODE=real and DEVFORGE_TERMINAL_TOKEN to enable protected ephemeral shell execution."
        : cloud
          ? "Vercel: commands run in an ephemeral /tmp workspace after token verification. Files do not persist between function instances."
          : "Local: commands run in .devforge-workspace/ with a real shell.",
  });
}

type Body = {
  command?: string;
  confirmed?: boolean;
  sessionId?: string;
  rootName?: string;
  files?: ProjectFile[];
  terminalToken?: string;
  /** Optional mock override for demos. Real mode is controlled by server env. */
  mode?: "mock";
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

    const mode = body.mode === "mock" ? "mock" : getTerminalMode();

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
      // Annotate cloud limitation on the entry
      if (result.entry && isCloudRuntime()) {
        result.entry.lines = [
          {
            id: `cloud-${Date.now()}`,
            level: "warning",
            text: "[CLOUD] Real shell is unavailable on Vercel. Showing simulated terminal output. Run locally for a real shell.",
            timestamp: Date.now(),
          },
          ...result.entry.lines,
        ];
      }

      return NextResponse.json({
        mode,
        requiresConfirmation: result.requiresConfirmation,
        confirmationReason: result.confirmationReason,
        mocked: true,
        cloud: isCloudRuntime(),
        entry: result.entry,
        notice: isCloudRuntime()
          ? "CLOUD TERMINAL — simulated on Vercel. Use local npm run dev for a real shell."
          : "MOCK TERMINAL — simulated output only.",
      });
    }

    // --- Real terminal ---
    if (!verifyCloudTerminalToken(req, body.terminalToken)) {
      return NextResponse.json(
        {
          mode,
          mocked: false,
          hardBlocked: false,
          entry: null,
          error:
            "Protected Vercel terminal requires DEVFORGE_TERMINAL_TOKEN.",
          notice:
            "Set DEVFORGE_TERMINAL_TOKEN in Vercel and enter the same token in the terminal panel.",
        },
        { status: 401 }
      );
    }

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
      mode,
      requiresConfirmation: result.requiresConfirmation,
      confirmationReason: result.confirmationReason,
      hardBlocked: result.hardBlocked ?? false,
      mocked: false,
      cwd,
      entry: result.entry,
      notice:
        isCloudRuntime()
          ? "REAL VERCEL TERMINAL — commands run in ephemeral /tmp storage after token verification. Not durable and not a full OS sandbox."
          : "REAL TERMINAL — commands run on this machine inside the DevForge workspace directory. Not a full OS sandbox.",
    });
  } catch (err) {
    console.error("[api/terminal]", err);
    const message = err instanceof Error ? err.message : "Terminal error";
    return NextResponse.json({ error: message, mocked: false }, { status: 500 });
  }
}
