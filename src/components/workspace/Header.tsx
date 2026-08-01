"use client";

import {
  Bug,
  FileCode2,
  FlaskConical,
  Hammer,
  History,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { AgentMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODES: {
  id: AgentMode;
  label: string;
  icon: React.ReactNode;
  tip: string;
}[] = [
  { id: "build", label: "Build", icon: <Hammer className="h-3.5 w-3.5" />, tip: "Create a project from a description" },
  { id: "debug", label: "Debug", icon: <Bug className="h-3.5 w-3.5" />, tip: "Diagnose errors with minimal fixes" },
  { id: "review", label: "Review", icon: <FileCode2 className="h-3.5 w-3.5" />, tip: "Find bugs, security, and design issues" },
  { id: "explain", label: "Explain", icon: <MessageSquareText className="h-3.5 w-3.5" />, tip: "Explain code clearly" },
  { id: "test", label: "Test", icon: <FlaskConical className="h-3.5 w-3.5" />, tip: "Generate tests (never invent results)" },
];

export function Header() {
  const mode = useWorkspaceStore((s) => s.mode);
  const setMode = useWorkspaceStore((s) => s.setMode);
  const leftCollapsed = useWorkspaceStore((s) => s.leftCollapsed);
  const rightCollapsed = useWorkspaceStore((s) => s.rightCollapsed);
  const setLeftCollapsed = useWorkspaceStore((s) => s.setLeftCollapsed);
  const setRightCollapsed = useWorkspaceStore((s) => s.setRightCollapsed);
  const resetProject = useWorkspaceStore((s) => s.resetProject);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const sessionId = useWorkspaceStore((s) => s.sessionId);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-text">
              DevForge
            </h1>
            <Badge tone="muted">v0.1</Badge>
          </div>
          <p
            className="truncate text-[11px] text-text-dim"
            suppressHydrationWarning
          >
            {rootName} · session {sessionId.slice(0, 6)}
          </p>
        </div>
      </div>

      <div className="mx-auto flex items-center gap-1 rounded-lg border border-border bg-bg p-0.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.tip}
            onClick={() => setMode(m.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mode === m.id
                ? "bg-accent text-white shadow-sm"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            )}
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          title={leftCollapsed ? "Show project panel" : "Hide project panel"}
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="hidden md:inline-flex"
        >
          {leftCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title={rightCollapsed ? "Show agent panel" : "Hide agent panel"}
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="hidden md:inline-flex"
        >
          {rightCollapsed ? (
            <PanelRightOpen className="h-4 w-4" />
          ) : (
            <PanelRightClose className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="Reset sample project & session"
          onClick={() => {
            if (
              confirm(
                "Reset the sample project and chat history? Unsaved session state will be cleared."
              )
            ) {
              resetProject();
            }
          }}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="hidden lg:flex items-center gap-1.5 pl-2 text-[11px] text-text-dim">
          <History className="h-3.5 w-3.5" />
          Session saved locally
        </div>
      </div>
    </header>
  );
}
