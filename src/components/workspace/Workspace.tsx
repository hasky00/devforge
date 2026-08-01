"use client";

import { useEffect } from "react";
import { Header } from "./Header";
import { ProjectPanel } from "./ProjectPanel";
import { CodeEditor } from "./CodeEditor";
import { AgentChat } from "./AgentChat";
import { TerminalPanel } from "./TerminalPanel";
import { ChangesPanel } from "./ChangesPanel";
import { useWorkspaceStore } from "@/store/workspace-store";
import { cn } from "@/lib/utils";
import {
  FileCode2,
  FolderTree,
  MessageSquare,
  FileDiff,
  Terminal,
} from "lucide-react";

const MOBILE_TABS = [
  { id: "files" as const, label: "Files", icon: FolderTree },
  { id: "editor" as const, label: "Code", icon: FileCode2 },
  { id: "chat" as const, label: "Agent", icon: MessageSquare },
  { id: "terminal" as const, label: "Term", icon: Terminal },
  { id: "changes" as const, label: "Diff", icon: FileDiff },
];

export function Workspace() {
  const leftCollapsed = useWorkspaceStore((s) => s.leftCollapsed);
  const rightCollapsed = useWorkspaceStore((s) => s.rightCollapsed);
  const bottomCollapsed = useWorkspaceStore((s) => s.bottomCollapsed);
  const setBottomCollapsed = useWorkspaceStore((s) => s.setBottomCollapsed);
  const mobileTab = useWorkspaceStore((s) => s.mobileTab);
  const setMobileTab = useWorkspaceStore((s) => s.setMobileTab);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath);

  // Open the buggy demo file on first load for a better first experience
  useEffect(() => {
    if (!activeFilePath) {
      openFile("src/routes/tasks.ts");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-text">
      <Header />

      {/* Desktop layout */}
      <div className="hidden min-h-0 flex-1 md:flex">
        {/* Project */}
        {!leftCollapsed && (
          <aside className="w-56 shrink-0 border-r border-border lg:w-64">
            <ProjectPanel />
          </aside>
        )}

        {/* Center: editor + terminal */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "min-h-0 border-b border-border",
              bottomCollapsed ? "flex-1" : "flex-[1.4]"
            )}
          >
            <CodeEditor />
          </div>
          {!bottomCollapsed ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                className="flex h-6 items-center justify-center border-b border-border bg-surface text-[10px] text-text-dim hover:text-text"
                onClick={() => setBottomCollapsed(true)}
              >
                Collapse terminal
              </button>
              <div className="min-h-0 flex-1">
                <TerminalPanel />
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex h-7 items-center gap-2 border-t border-border bg-surface px-3 text-[11px] text-text-dim hover:text-text"
              onClick={() => setBottomCollapsed(false)}
            >
              <Terminal className="h-3 w-3" />
              Show terminal
            </button>
          )}
        </div>

        {/* Right: chat + changes */}
        {!rightCollapsed && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-border xl:w-96">
            <div className="min-h-0 flex-[1.3] border-b border-border">
              <AgentChat />
            </div>
            <div className="min-h-0 flex-1">
              <ChangesPanel />
            </div>
          </aside>
        )}
      </div>

      {/* Mobile layout */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="min-h-0 flex-1">
          {mobileTab === "files" && <ProjectPanel />}
          {mobileTab === "editor" && <CodeEditor />}
          {mobileTab === "chat" && <AgentChat />}
          {mobileTab === "terminal" && <TerminalPanel />}
          {mobileTab === "changes" && <ChangesPanel />}
        </div>
        <nav className="flex shrink-0 border-t border-border bg-surface">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = mobileTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMobileTab(tab.id)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                  active ? "text-accent" : "text-text-dim"
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
