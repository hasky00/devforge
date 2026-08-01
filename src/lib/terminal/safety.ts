/**
 * Command safety analysis for the real local terminal.
 * Not a full sandbox — cwd is restricted, but the shell runs as the local user.
 */

const DESTRUCTIVE =
  /\b(rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*\s--force)|git\s+push\s+.*--force|git\s+reset\s+--hard|git\s+clean\s+-f|drop\s+table|DROP\s+TABLE|DROP\s+DATABASE|migrate:reset|db:drop|mkfs\.|dd\s+if=)\b/i;

/** Hard-blocked: never run, even with confirmation */
const HARD_BLOCK =
  /\b(rm\s+-rf\s+\/|rm\s+-rf\s+~|rm\s+-rf\s+\$HOME|:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;|curl\s+[^\n|]*\|\s*(ba)?sh|wget\s+[^\n|]*\|\s*(ba)?sh|shutdown|reboot|halt|mkfs|dd\s+if=.*of=\/dev\/)\b/i;

const ESCAPE_CWD =
  /(^|[;&|`]|\s)(cd\s+(\/|~|\$HOME|\.\.\/\.\.)|pushd\s+(\/|~))/i;

export function analyzeCommand(command: string): {
  requiresConfirmation: boolean;
  hardBlocked: boolean;
  reason?: string;
} {
  if (HARD_BLOCK.test(command)) {
    return {
      hardBlocked: true,
      requiresConfirmation: false,
      reason:
        "This command is hard-blocked for safety (system wipe, pipe-to-shell, shutdown, etc.).",
    };
  }

  if (ESCAPE_CWD.test(command)) {
    return {
      hardBlocked: false,
      requiresConfirmation: true,
      reason:
        "This command may leave the project workspace directory. Confirm only if you intend that.",
    };
  }

  if (DESTRUCTIVE.test(command)) {
    return {
      hardBlocked: false,
      requiresConfirmation: true,
      reason:
        "This command looks destructive (delete/reset/force). Explicit confirmation required.",
    };
  }

  return { hardBlocked: false, requiresConfirmation: false };
}

/** Longer timeouts for install/build; short capture for forever servers */
export function timeoutForCommand(command: string): number {
  const c = command.trim();
  if (/\b(npm|pnpm|yarn|bun)\s+(i|install|ci)\b/.test(c)) return 300_000;
  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(build|test)\b/.test(c)) return 180_000;
  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|watch)\b/.test(c)) {
    return 8_000; // capture startup logs, then stop
  }
  if (/\b(npx\s+tsx\s+watch|nodemon|next\s+dev)\b/.test(c)) return 8_000;
  return 60_000;
}

export function isLongRunningCommand(command: string): boolean {
  return timeoutForCommand(command) <= 8_000 &&
    /\b(dev|start|watch|serve)\b/i.test(command);
}
