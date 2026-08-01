"use client";

import { useState } from "react";
import {
  Check,
  FileDiff,
  Pencil,
  X,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { DiffLine, ProposedChange } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChangesPanel() {
  const proposedChanges = useWorkspaceStore((s) => s.proposedChanges);
  const acceptChange = useWorkspaceStore((s) => s.acceptChange);
  const rejectChange = useWorkspaceStore((s) => s.rejectChange);
  const updateChangeContent = useWorkspaceStore((s) => s.updateChangeContent);
  const clearResolvedChanges = useWorkspaceStore((s) => s.clearResolvedChanges);
  const openFile = useWorkspaceStore((s) => s.openFile);
  const setAgentFocusPath = useWorkspaceStore((s) => s.setAgentFocusPath);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");

  const pending = proposedChanges.filter(
    (c) => c.status === "pending" || c.status === "edited"
  );
  const resolved = proposedChanges.filter(
    (c) => c.status === "accepted" || c.status === "rejected"
  );

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <FileDiff className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            Changes
          </span>
          {pending.length > 0 && (
            <Badge tone="accent">{pending.length} pending</Badge>
          )}
        </div>
        {resolved.length > 0 && (
          <Button size="sm" variant="ghost" onClick={clearResolvedChanges}>
            Clear resolved
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {proposedChanges.length === 0 && (
          <div className="p-4 text-center text-xs text-text-dim">
            <p>No proposed changes yet.</p>
            <p className="mt-1">
              Ask the agent to fix a bug or generate files — diffs appear here
              before anything is applied.
            </p>
          </div>
        )}

        {proposedChanges.map((change) => (
          <ChangeCard
            key={change.id}
            change={change}
            isEditing={editingId === change.id}
            editBuffer={editBuffer}
            onEditStart={() => {
              setEditingId(change.id);
              setEditBuffer(change.proposedContent);
            }}
            onEditBuffer={setEditBuffer}
            onEditSave={() => {
              updateChangeContent(change.id, editBuffer);
              setEditingId(null);
            }}
            onEditCancel={() => setEditingId(null)}
            onAccept={() => {
              acceptChange(change.id);
              openFile(change.path);
            }}
            onReject={() => rejectChange(change.id)}
            onFocus={() => {
              setAgentFocusPath(change.path);
              openFile(change.path);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChangeCard({
  change,
  isEditing,
  editBuffer,
  onEditStart,
  onEditBuffer,
  onEditSave,
  onEditCancel,
  onAccept,
  onReject,
  onFocus,
}: {
  change: ProposedChange;
  isEditing: boolean;
  editBuffer: string;
  onEditStart: () => void;
  onEditBuffer: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onAccept: () => void;
  onReject: () => void;
  onFocus: () => void;
}) {
  const statusTone =
    change.status === "accepted"
      ? "success"
      : change.status === "rejected"
        ? "danger"
        : change.status === "edited"
          ? "warning"
          : "accent";

  const actionable =
    change.status === "pending" || change.status === "edited";

  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-border bg-bg">
      <div className="flex flex-wrap items-start gap-2 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={onFocus}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate font-mono text-xs text-text">
            {change.path}
          </div>
          <div className="mt-0.5 text-[11px] text-text-muted">
            {change.description}
          </div>
        </button>
        <Badge tone={statusTone}>{change.kind}</Badge>
        <Badge tone="muted">{change.status}</Badge>
      </div>

      {isEditing ? (
        <div className="p-2">
          <textarea
            value={editBuffer}
            onChange={(e) => onEditBuffer(e.target.value)}
            rows={12}
            className="w-full resize-y rounded-lg border border-border bg-surface p-2 font-mono text-[11px] text-text outline-none focus:border-accent/50"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="primary" onClick={onEditSave}>
              Save edit
            </Button>
            <Button size="sm" variant="ghost" onClick={onEditCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-h-48 overflow-auto font-mono text-[11px] leading-5">
          {change.diff.length === 0 ? (
            <div className="p-2 text-text-dim">(empty diff)</div>
          ) : (
            change.diff.map((line, i) => <DiffRow key={i} line={line} />)
          )}
        </div>
      )}

      {actionable && !isEditing && (
        <div className="flex gap-1.5 border-t border-border p-2">
          <Button size="sm" variant="success" onClick={onAccept}>
            <Check className="h-3.5 w-3.5" />
            Accept
          </Button>
          <Button size="sm" variant="danger" onClick={onReject}>
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
          <Button size="sm" variant="secondary" onClick={onEditStart}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  return (
    <div
      className={cn(
        "flex px-2",
        line.type === "add" && "bg-success/10 text-success",
        line.type === "remove" && "bg-danger/10 text-danger",
        line.type === "context" && "text-text-dim"
      )}
    >
      <span className="w-4 shrink-0 select-none opacity-70">
        {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
      </span>
      <span className="w-8 shrink-0 select-none text-right opacity-40 pr-2">
        {line.oldLineNumber ?? line.newLineNumber ?? ""}
      </span>
      <span className="whitespace-pre-wrap break-all">{line.content || " "}</span>
    </div>
  );
}
