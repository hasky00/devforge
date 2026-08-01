import { spawn } from "child_process";
import { nanoid } from "nanoid";
import type { TerminalEntry, TerminalLine } from "../types";
import {
  analyzeCommand,
  isLongRunningCommand,
  timeoutForCommand,
} from "./safety";

export interface ExecuteResult {
  entry: TerminalEntry;
  requiresConfirmation: boolean;
  confirmationReason?: string;
  hardBlocked?: boolean;
}

const MAX_OUTPUT_CHARS = 120_000;
const MAX_LINES = 2_000;

function line(
  level: TerminalLine["level"],
  text: string
): TerminalLine {
  return { id: nanoid(), level, text, timestamp: Date.now() };
}

function classifyStderr(text: string): TerminalLine["level"] {
  if (/\b(warn(ing)?|deprecated|npm warn)\b/i.test(text)) return "warning";
  if (/\b(error|ERR!|failed|fatal)\b/i.test(text)) return "error";
  return "stderr";
}

/**
 * Run a real shell command with cwd locked to the project workspace.
 * confirmedSuccess is true only when the process exits with code 0.
 */
export async function executeRealCommand(options: {
  command: string;
  cwd: string;
  confirmed?: boolean;
  timeoutMs?: number;
}): Promise<ExecuteResult> {
  const command = options.command.trim();
  const startedAt = Date.now();
  const analysis = analyzeCommand(command);

  if (analysis.hardBlocked) {
    return {
      hardBlocked: true,
      requiresConfirmation: false,
      confirmationReason: analysis.reason,
      entry: {
        id: nanoid(),
        command,
        lines: [
          line("error", "Command blocked for safety."),
          line("info", analysis.reason ?? "Hard-blocked pattern."),
        ],
        confirmedSuccess: false,
        mocked: false,
        exitCode: null,
        startedAt,
        finishedAt: Date.now(),
      },
    };
  }

  if (analysis.requiresConfirmation && !options.confirmed) {
    return {
      requiresConfirmation: true,
      confirmationReason: analysis.reason,
      entry: {
        id: nanoid(),
        command,
        lines: [
          line("warning", "⚠ Destructive or risky command blocked pending confirmation."),
          line("info", analysis.reason ?? "Confirm to proceed."),
        ],
        confirmedSuccess: false,
        mocked: false,
        exitCode: null,
        startedAt,
        finishedAt: Date.now(),
      },
    };
  }

  const timeoutMs = options.timeoutMs ?? timeoutForCommand(command);
  const longRunning = isLongRunningCommand(command);

  const result = await runShell(command, options.cwd, timeoutMs);

  const lines: TerminalLine[] = [
    line("info", `[REAL] cwd: ${options.cwd}`),
    line("info", `[REAL] shell: ${getShell()} · timeout ${timeoutMs}ms`),
  ];

  if (longRunning) {
    lines.push(
      line(
        "warning",
        "Long-running command: captured startup output, then stopped the process. Use your system terminal for servers that must stay up."
      )
    );
  }

  for (const row of result.stdoutLines) {
    lines.push(line("stdout", row));
  }
  for (const row of result.stderrLines) {
    lines.push(line(classifyStderr(row), row));
  }

  if (result.timedOut) {
    lines.push(
      line(
        "warning",
        `Process stopped after ${timeoutMs}ms timeout${longRunning ? " (expected for dev servers)" : ""}.`
      )
    );
  }

  if (result.truncated) {
    lines.push(line("warning", "Output truncated to size limit."));
  }

  const exitCode = result.exitCode;
  // Only claim success when process exited 0 without hard failure path
  const confirmedSuccess = exitCode === 0 && !result.timedOut;

  if (confirmedSuccess) {
    lines.push(line("success", `Process exited 0 (success confirmed).`));
  } else if (result.timedOut && longRunning && exitCode === null) {
    lines.push(
      line(
        "info",
        "No exit code — process was stopped after startup capture. Success not claimed for the full server lifetime."
      )
    );
  } else if (exitCode !== null && exitCode !== 0) {
    lines.push(line("error", `Process exited with code ${exitCode}.`));
  }

  return {
    requiresConfirmation: false,
    entry: {
      id: nanoid(),
      command,
      lines,
      confirmedSuccess,
      mocked: false,
      exitCode: exitCode ?? (result.timedOut ? 124 : null),
      startedAt,
      finishedAt: Date.now(),
    },
  };
}

function runShell(
  command: string,
  cwd: string,
  timeoutMs: number
): Promise<{
  stdoutLines: string[];
  stderrLines: string[];
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
}> {
  return new Promise((resolve) => {
    const shell = getShell();
    const child = spawn(shell, ["-c", command], {
      cwd,
      env: {
        ...process.env,
        // Avoid interactive prompts hanging the request
        CI: process.env.CI || "true",
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        npm_config_yes: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const append = (buf: Buffer, which: "out" | "err") => {
      const chunk = buf.toString("utf8");
      if (which === "out") {
        if (stdout.length + chunk.length > MAX_OUTPUT_CHARS) {
          stdout += chunk.slice(0, Math.max(0, MAX_OUTPUT_CHARS - stdout.length));
          truncated = true;
        } else {
          stdout += chunk;
        }
      } else {
        if (stderr.length + chunk.length > MAX_OUTPUT_CHARS) {
          stderr += chunk.slice(0, Math.max(0, MAX_OUTPUT_CHARS - stderr.length));
          truncated = true;
        } else {
          stderr += chunk;
        }
      }
    };

    child.stdout?.on("data", (d: Buffer) => append(d, "out"));
    child.stderr?.on("data", (d: Buffer) => append(d, "err"));

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
        setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            /* ignore */
          }
        }, 1500).unref?.();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const split = (s: string) => {
        if (!s) return [] as string[];
        const parts = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        if (parts.length && parts[parts.length - 1] === "") parts.pop();
        return parts.slice(0, MAX_LINES);
      };

      resolve({
        stdoutLines: split(stdout),
        stderrLines: split(stderr),
        exitCode,
        timedOut,
        truncated: truncated || split(stdout).length >= MAX_LINES || split(stderr).length >= MAX_LINES,
      });
    };

    child.on("error", (err) => {
      stderr += (stderr ? "\n" : "") + err.message;
      finish(1);
    });

    child.on("close", (code) => {
      finish(code);
    });
  });
}

function getShell(): string {
  if (process.env.SHELL) return process.env.SHELL;
  return process.env.VERCEL === "1" ? "/bin/sh" : "/bin/zsh";
}
