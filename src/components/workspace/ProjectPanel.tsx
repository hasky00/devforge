"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FilePlus,
  Folder,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { ProjectFile } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

export function ProjectPanel() {
  const files = useWorkspaceStore((s) => s.files);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const activeFilePath = useWorkspaceStore((s) => s.activeFilePath);
  const agentFocusPath = useWorkspaceStore((s) => s.agentFocusPath);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const createNewFile = useWorkspaceStore((s) => s.createNewFile);
  const deleteFile = useWorkspaceStore((s) => s.deleteFile);
  const renameFile = useWorkspaceStore((s) => s.renameFile);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    src: true,
    "src/routes": true,
    "src/middleware": true,
  });
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const toggle = (path: string) =>
    setExpanded((e) => ({ ...e, [path]: !e[path] }));

  const handleCreate = (type: "file" | "folder") => {
    const name = prompt(
      type === "file" ? "New file name (e.g. utils.ts)" : "New folder name"
    );
    if (!name?.trim()) return;
    createNewFile(null, name.trim(), type);
    if (type === "folder") {
      setExpanded((e) => ({ ...e, [name.trim()]: true }));
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-border px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
          Project
        </span>
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            title="New file"
            onClick={() => handleCreate("file")}
          >
            <FilePlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            title="New folder"
            onClick={() => handleCreate("folder")}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 text-sm">
        <div className="mb-1 flex items-center gap-1.5 px-1 py-0.5 text-xs font-medium text-text">
          <Folder className="h-3.5 w-3.5 text-accent" />
          {rootName}
        </div>
        <Tree
          nodes={files}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          activeFilePath={activeFilePath}
          agentFocusPath={agentFocusPath}
          openFile={openFile}
          onDelete={(path) => setPendingDelete(path)}
          onRenameStart={(path, name) => {
            setRenaming(path);
            setRenameValue(name);
          }}
          renaming={renaming}
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onRenameCommit={() => {
            if (renaming && renameValue.trim()) {
              renameFile(renaming, renameValue.trim());
            }
            setRenaming(null);
          }}
          onRenameCancel={() => setRenaming(null)}
        />
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete file?"
        message={`This will permanently remove "${pendingDelete}" from the project session. This action needs your confirmation.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteFile(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function Tree({
  nodes,
  depth,
  expanded,
  toggle,
  activeFilePath,
  agentFocusPath,
  openFile,
  onDelete,
  onRenameStart,
  renaming,
  renameValue,
  setRenameValue,
  onRenameCommit,
  onRenameCancel,
}: {
  nodes: ProjectFile[];
  depth: number;
  expanded: Record<string, boolean>;
  toggle: (path: string) => void;
  activeFilePath: string | null;
  agentFocusPath: string | null;
  openFile: (path: string) => void;
  onDelete: (path: string) => void;
  onRenameStart: (path: string, name: string) => void;
  renaming: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}) {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <ul className="select-none">
      {sorted.map((node) => {
        const isOpen = expanded[node.path] ?? false;
        const isActive = activeFilePath === node.path;
        const isFocus = agentFocusPath === node.path;
        const isRenaming = renaming === node.path;

        return (
          <li key={node.id}>
            <div
              className={cn(
                "group flex items-center gap-0.5 rounded-md pr-1 text-[13px]",
                isActive && "bg-accent/15 text-text",
                isFocus && !isActive && "ring-1 ring-accent/40 bg-accent/5",
                !isActive && "hover:bg-surface-2 text-text-muted"
              )}
              style={{ paddingLeft: 8 + depth * 12 }}
            >
              {node.type === "folder" ? (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
                  onClick={() => toggle(node.path)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-dim" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-dim" />
                  )}
                  <Folder className="h-3.5 w-3.5 shrink-0 text-warning/80" />
                  {isRenaming ? (
                    <RenameInput
                      value={renameValue}
                      onChange={setRenameValue}
                      onCommit={onRenameCommit}
                      onCancel={onRenameCancel}
                    />
                  ) : (
                    <span className="truncate">{node.name}</span>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1 py-1 text-left"
                  onClick={() => openFile(node.path)}
                >
                  <span className="w-3.5" />
                  <File className="h-3.5 w-3.5 shrink-0 text-text-dim" />
                  {isRenaming ? (
                    <RenameInput
                      value={renameValue}
                      onChange={setRenameValue}
                      onCommit={onRenameCommit}
                      onCancel={onRenameCancel}
                    />
                  ) : (
                    <span className="truncate">{node.name}</span>
                  )}
                  {isFocus && (
                    <span className="ml-auto shrink-0 rounded bg-accent/20 px-1 text-[9px] font-semibold text-accent">
                      agent
                    </span>
                  )}
                </button>
              )}
              {!isRenaming && (
                <div className="hidden shrink-0 items-center group-hover:flex">
                  <button
                    type="button"
                    className="rounded p-0.5 text-text-dim hover:text-text"
                    title="Rename"
                    onClick={() => onRenameStart(node.path, node.name)}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-0.5 text-text-dim hover:text-danger"
                    title="Delete"
                    onClick={() => onDelete(node.path)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {node.type === "folder" && isOpen && node.children && (
              <Tree
                nodes={node.children}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                activeFilePath={activeFilePath}
                agentFocusPath={agentFocusPath}
                openFile={openFile}
                onDelete={onDelete}
                onRenameStart={onRenameStart}
                renaming={renaming}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                onRenameCommit={onRenameCommit}
                onRenameCancel={onRenameCancel}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit();
        if (e.key === "Escape") onCancel();
      }}
      className="min-w-0 flex-1 rounded border border-accent bg-bg px-1 py-0.5 text-[12px] text-text outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
