import { nanoid } from "nanoid";
import type { TerminalEntry, TerminalLine } from "../types";

/**
 * Mock terminal — clearly labeled. Never claims success without synthetic output
 * that matches a known command pattern. Real sandbox can replace this module later.
 */

const DESTRUCTIVE =
  /\b(rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|drop\s+table|DROP\s+TABLE|migrate:reset|db:drop)\b/i;

export interface ExecuteResult {
  entry: TerminalEntry;
  requiresConfirmation: boolean;
  confirmationReason?: string;
}

export function analyzeCommand(command: string): {
  requiresConfirmation: boolean;
  reason?: string;
} {
  if (DESTRUCTIVE.test(command)) {
    return {
      requiresConfirmation: true,
      reason:
        "This command looks destructive (delete/reset/force). Confirm before running.",
    };
  }
  return { requiresConfirmation: false };
}

export async function executeMockCommand(
  command: string,
  options?: { confirmed?: boolean }
): Promise<ExecuteResult> {
  const startedAt = Date.now();
  const analysis = analyzeCommand(command);

  if (analysis.requiresConfirmation && !options?.confirmed) {
    const entry: TerminalEntry = {
      id: nanoid(),
      command,
      lines: [
        line("warning", "⚠ Destructive command blocked pending confirmation."),
        line("info", analysis.reason ?? "Confirm to proceed."),
      ],
      confirmedSuccess: false,
      mocked: true,
      exitCode: null,
      startedAt,
      finishedAt: Date.now(),
    };
    return {
      entry,
      requiresConfirmation: true,
      confirmationReason: analysis.reason,
    };
  }

  await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

  const trimmed = command.trim();
  const { lines, exitCode, confirmedSuccess } = simulate(trimmed);

  const entry: TerminalEntry = {
    id: nanoid(),
    command: trimmed,
    lines: [
      line("info", "[MOCK TERMINAL] Simulated execution — not a real shell."),
      ...lines,
    ],
    confirmedSuccess,
    mocked: true,
    exitCode,
    startedAt,
    finishedAt: Date.now(),
  };

  return { entry, requiresConfirmation: false };
}

function line(
  level: TerminalLine["level"],
  text: string
): TerminalLine {
  return { id: nanoid(), level, text, timestamp: Date.now() };
}

function simulate(cmd: string): {
  lines: TerminalLine[];
  exitCode: number;
  confirmedSuccess: boolean;
} {
  if (!cmd) {
    return {
      lines: [line("stderr", "Empty command")],
      exitCode: 1,
      confirmedSuccess: false,
    };
  }

  if (/^npm\s+test/.test(cmd) || /^pnpm\s+test/.test(cmd)) {
    return {
      lines: [
        line("stdout", "> taskflow-api@0.1.0 test"),
        line("stdout", "> node --import tsx --test src/**/*.test.ts"),
        line("stdout", ""),
        line("stdout", "✔ creates a task with a title (1.2ms)"),
        line("stdout", "✔ lists created tasks (0.4ms)"),
        line("stdout", "✔ toggles completion (0.3ms)"),
        line("stdout", ""),
        line("success", "ℹ tests 3"),
        line("success", "ℹ pass 3"),
        line("success", "ℹ fail 0"),
        line("info", "Note: mock output — real runs may differ."),
      ],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  if (/^npm\s+install/.test(cmd) || /^npm\s+i\b/.test(cmd)) {
    return {
      lines: [
        line("stdout", "added 87 packages in 2s"),
        line("success", "Mock install completed with exit code 0."),
      ],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  if (/^npm\s+run\s+dev/.test(cmd) || /^npm\s+start/.test(cmd)) {
    return {
      lines: [
        line("stdout", "> taskflow-api@0.1.0 dev"),
        line("stdout", "TaskFlow listening on http://localhost:3001"),
        line("info", "Mock server log only — no process is actually listening."),
      ],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  if (/^npm\s+run\s+build/.test(cmd) || /^tsc\b/.test(cmd)) {
    return {
      lines: [
        line("stdout", "> tsc"),
        line("success", "Mock compile finished (exit 0)."),
      ],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  if (/^curl\b/.test(cmd)) {
    if (cmd.includes("/tasks") && cmd.includes("POST")) {
      return {
        lines: [
          line(
            "stdout",
            '{"id":"mock-uuid","title":"Ship DevForge","completed":false,"createdAt":"2026-08-01T12:00:00.000Z"}'
          ),
          line("success", "Mock HTTP 201 body printed above."),
        ],
        exitCode: 0,
        confirmedSuccess: true,
      };
    }
    if (cmd.includes("/health")) {
      return {
        lines: [
          line("stdout", '{"ok":true,"service":"taskflow-api"}'),
          line("success", "Mock health check body printed above."),
        ],
        exitCode: 0,
        confirmedSuccess: true,
      };
    }
    return {
      lines: [
        line("stdout", '{"mocked":true}'),
        line("info", "Generic mock curl response."),
      ],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  if (/^git\s+status/.test(cmd)) {
    return {
      lines: [
        line("stdout", "On branch main"),
        line("stdout", "nothing to commit, working tree clean"),
        line("info", "Mock git status."),
      ],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  if (/^ls\b/.test(cmd) || /^tree\b/.test(cmd)) {
    return {
      lines: [
        line("stdout", "README.md"),
        line("stdout", "package.json"),
        line("stdout", "src/"),
        line("stdout", "tsconfig.json"),
      ],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  if (/^echo\s+/.test(cmd)) {
    const text = cmd.replace(/^echo\s+/, "").replace(/^["']|["']$/g, "");
    return {
      lines: [line("stdout", text)],
      exitCode: 0,
      confirmedSuccess: true,
    };
  }

  // Unknown: do not claim success
  return {
    lines: [
      line(
        "warning",
        `No mock handler for: ${cmd}`
      ),
      line(
        "info",
        "Command was not executed. Connect a real sandboxed terminal to run arbitrary commands."
      ),
      line("stderr", "mock: command pattern not simulated"),
    ],
    exitCode: 127,
    confirmedSuccess: false,
  };
}
