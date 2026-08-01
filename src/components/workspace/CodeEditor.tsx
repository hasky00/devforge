"use client";

import { useMemo } from "react";
import { Copy, Save, X } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { findFile } from "@/lib/project/file-tree";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function CodeEditor() {
  const files = useWorkspaceStore((s) => s.files);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath);
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile);
  const closeTab = useWorkspaceStore((s) => s.closeTab);
  const updateActiveContent = useWorkspaceStore((s) => s.updateActiveContent);
  const saveActiveFile = useWorkspaceStore((s) => s.saveActiveFile);

  const activeFile = activeFilePath
    ? findFile(files, activeFilePath)
    : null;
  const activeTab = openTabs.find((t) => t.path === activeFilePath);
  const content = activeFile?.content ?? "";
  const lines = useMemo(() => content.split("\n"), [content]);
  const changed = new Set(activeTab?.changedLines ?? []);

  const copy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
  };

  return (
    <div className="flex h-full min-w-0 flex-col bg-bg">
      {/* Tabs */}
      <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface">
        {openTabs.length === 0 && (
          <div className="flex items-center px-3 text-xs text-text-dim">
            Open a file from the project panel
          </div>
        )}
        {openTabs.map((tab) => (
          <div
            key={tab.path}
            className={cn(
              "group flex max-w-[180px] items-center gap-1 border-r border-border px-2 text-xs",
              tab.path === activeFilePath
                ? "bg-bg text-text"
                : "bg-surface text-text-muted hover:bg-surface-2"
            )}
          >
            <button
              type="button"
              className="min-w-0 truncate py-2 text-left"
              onClick={() => setActiveFile(tab.path)}
              title={tab.path}
            >
              {tab.dirty && (
                <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-warning" />
              )}
              {tab.name}
            </button>
            <button
              type="button"
              className="rounded p-0.5 opacity-60 hover:bg-surface-3 hover:opacity-100"
              onClick={() => closeTab(tab.path)}
              aria-label={`Close ${tab.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <div className="ml-auto flex shrink-0 items-center gap-1 px-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={copy}
            disabled={!activeFile}
            title="Copy file contents"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={saveActiveFile}
            disabled={!activeTab?.dirty}
            title="Mark file saved in session"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>

      {/* Path bar */}
      {activeFilePath && (
        <div className="flex h-7 shrink-0 items-center border-b border-border px-3 text-[11px] text-text-dim">
          <span className="font-mono">{activeFilePath}</span>
          {activeFile?.language && (
            <span className="ml-auto rounded bg-surface-2 px-1.5 py-0.5 uppercase">
              {activeFile.language}
            </span>
          )}
        </div>
      )}

      {/* Editor body */}
      {!activeFile || activeFile.type !== "file" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="text-sm text-text-muted">No file selected</p>
          <p className="max-w-sm text-xs text-text-dim">
            Browse the project panel, or ask the agent in Build mode to generate
            files. Proposed changes appear in the Changes panel before applying.
          </p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-auto">
          <div className="flex min-h-full font-mono text-[13px] leading-6">
            <div
              className="sticky left-0 z-10 select-none border-r border-border bg-surface/90 px-2 py-3 text-right text-text-dim backdrop-blur"
              aria-hidden
            >
              {lines.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "min-w-[2.5rem]",
                    changed.has(i + 1) && "bg-accent/20 text-accent"
                  )}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={content}
              onChange={(e) => updateActiveContent(e.target.value)}
              spellCheck={false}
              className="min-h-full w-full flex-1 resize-none bg-transparent py-3 pl-3 pr-4 text-text caret-accent outline-none"
              style={{
                lineHeight: "1.5rem",
                tabSize: 2,
              }}
              aria-label={`Edit ${activeFilePath}`}
            />
          </div>
          {/* Change highlight strip on left of content via line numbers above */}
        </div>
      )}
    </div>
  );
}
