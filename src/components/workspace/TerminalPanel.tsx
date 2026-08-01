"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Play, Terminal, Trash2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { TerminalEntry, TerminalLine } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TerminalPanel() {
  const terminal = useWorkspaceStore((s) => s.terminal);
  const pushTerminalEntry = useWorkspaceStore((s) => s.pushTerminalEntry);
  const clearTerminal = useWorkspaceStore((s) => s.clearTerminal);
  const files = useWorkspaceStore((s) => s.files);
  const sessionId = useWorkspaceStore((s) => s.sessionId);
  const rootName = useWorkspaceStore((s) => s.rootName);

  const [command, setCommand] = useState("npm test");
  const [running, setRunning] = useState(false);
  const [cwdHint, setCwdHint] = useState<string | null>(null);
  const [pendingDestructive, setPendingDestructive] = useState<string | null>(
    null
  );
  const [pendingReason, setPendingReason] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminal]);

  const run = async (cmd: string, confirmed = false) => {
    const trimmed = cmd.trim();
    if (!trimmed || running) return;
    setRunning(true);
    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: trimmed,
          confirmed,
          sessionId,
          rootName,
          files,
          mode: "real",
        }),
      });
      const data = await res.json();

      if (data.cwd) setCwdHint(data.cwd);

      if (data.hardBlocked) {
        pushTerminalEntry({
          id: crypto.randomUUID(),
          command: trimmed,
          lines: [
            {
              id: crypto.randomUUID(),
              level: "error",
              text: data.error || data.confirmationReason || "Command blocked",
              timestamp: Date.now(),
            },
          ],
          confirmedSuccess: false,
          mocked: false,
          exitCode: null,
          startedAt: Date.now(),
          finishedAt: Date.now(),
        });
        return;
      }

      if (data.requiresConfirmation && !confirmed) {
        setPendingDestructive(trimmed);
        setPendingReason(data.confirmationReason);
        return;
      }

      if (data.entry) {
        pushTerminalEntry(data.entry as TerminalEntry);
      } else if (data.error) {
        pushTerminalEntry({
          id: crypto.randomUUID(),
          command: trimmed,
          lines: [
            {
              id: crypto.randomUUID(),
              level: "error",
              text: data.error,
              timestamp: Date.now(),
            },
          ],
          confirmedSuccess: false,
          mocked: Boolean(data.mocked),
          exitCode: 1,
          startedAt: Date.now(),
          finishedAt: Date.now(),
        });
      }
    } catch (e) {
      pushTerminalEntry({
        id: crypto.randomUUID(),
        command: trimmed,
        lines: [
          {
            id: crypto.randomUUID(),
            level: "error",
            text: e instanceof Error ? e.message : "Request failed",
            timestamp: Date.now(),
          },
        ],
        confirmedSuccess: false,
        mocked: false,
        exitCode: 1,
        startedAt: Date.now(),
        finishedAt: Date.now(),
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="flex h-9 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-success" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            Terminal
          </span>
          <Badge tone="success">Real</Badge>
          {cwdHint && (
            <span
              className="hidden truncate font-mono text-[10px] text-text-dim lg:inline max-w-[240px]"
              title={cwdHint}
            >
              {cwdHint}
            </span>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={clearTerminal}>
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-[12px]">
        {terminal.length === 0 && (
          <div className="space-y-2 text-text-dim">
            <p>
              Real local shell. Project files are synced to{" "}
              <code className="text-text-muted">.devforge-workspace/</code>{" "}
              then commands run with that directory as{" "}
              <code className="text-text-muted">cwd</code>.
            </p>
            <p>
              Try{" "}
              <QuickCmd
                label="npm install"
                onClick={() => {
                  setCommand("npm install");
                  void run("npm install");
                }}
              />
              ,{" "}
              <QuickCmd
                label="npm test"
                onClick={() => {
                  setCommand("npm test");
                  void run("npm test");
                }}
              />
              , or{" "}
              <QuickCmd
                label="ls -la"
                onClick={() => {
                  setCommand("ls -la");
                  void run("ls -la");
                }}
              />
              .
            </p>
            <p className="text-[11px]">
              Success is only claimed when the process exits with code 0.
              Long-running servers (e.g.{" "}
              <code className="text-text-muted">npm run dev</code>) are stopped
              after a short capture window.
            </p>
          </div>
        )}
        {terminal.map((entry) => (
          <div key={entry.id} className="mb-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-accent">$</span>
              <span className="text-text">{entry.command}</span>
              <button
                type="button"
                className="text-text-dim hover:text-text"
                title="Copy command"
                onClick={() =>
                  void navigator.clipboard.writeText(entry.command)
                }
              >
                <Copy className="h-3 w-3" />
              </button>
              {entry.mocked ? (
                <Badge tone="muted">mock</Badge>
              ) : (
                <Badge tone="success">real</Badge>
              )}
              {entry.exitCode !== null && (
                <Badge
                  tone={
                    entry.confirmedSuccess
                      ? "success"
                      : entry.exitCode === 0
                        ? "success"
                        : "danger"
                  }
                >
                  exit {entry.exitCode}
                  {entry.confirmedSuccess ? " · success" : ""}
                </Badge>
              )}
            </div>
            {entry.lines.map((line) => (
              <TerminalLineView key={line.id} line={line} />
            ))}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-border bg-surface p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(command);
        }}
      >
        <span className="pl-1 font-mono text-sm text-accent">$</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="flex-1 bg-transparent font-mono text-sm text-text outline-none placeholder:text-text-dim"
          placeholder={
            running
              ? "Running…"
              : "Enter command (real shell in project workspace)"
          }
          disabled={running}
          spellCheck={false}
        />
        <Button
          type="submit"
          size="sm"
          variant="primary"
          disabled={running || !command.trim()}
        >
          <Play className="h-3.5 w-3.5" />
          {running ? "…" : "Run"}
        </Button>
      </form>

      <ConfirmDialog
        open={!!pendingDestructive}
        title="Confirm risky command"
        message={
          pendingReason
            ? `"${pendingDestructive}" — ${pendingReason}`
            : `"${pendingDestructive}" may be destructive. DevForge requires explicit confirmation before running on your machine.`
        }
        confirmLabel="Run on this machine"
        danger
        onCancel={() => {
          setPendingDestructive(null);
          setPendingReason(undefined);
        }}
        onConfirm={() => {
          const cmd = pendingDestructive;
          setPendingDestructive(null);
          setPendingReason(undefined);
          if (cmd) void run(cmd, true);
        }}
      />
    </div>
  );
}

function QuickCmd({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="text-accent underline"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function TerminalLineView({ line }: { line: TerminalLine }) {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-all",
        line.level === "stderr" || line.level === "error"
          ? "text-danger"
          : line.level === "warning"
            ? "text-warning"
            : line.level === "success"
              ? "text-success"
              : line.level === "info"
                ? "text-text-dim"
                : line.level === "command"
                  ? "text-accent"
                  : "text-text-muted"
      )}
    >
      {line.text}
    </div>
  );
}
