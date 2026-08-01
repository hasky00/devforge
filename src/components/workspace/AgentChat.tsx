"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MarkdownLite } from "./MarkdownLite";
import type { AgentChatResponse, ExplainLevel } from "@/lib/types";
import { findFile } from "@/lib/project/file-tree";
import { cn, formatTime } from "@/lib/utils";

const EXPLAIN_LEVELS: { id: ExplainLevel; label: string }[] = [
  { id: "beginner", label: "Beginner" },
  { id: "technical", label: "Technical" },
  { id: "line-by-line", label: "Line-by-line" },
  { id: "architecture", label: "Architecture" },
];

export function AgentChat() {
  const messages = useWorkspaceStore((s) => s.messages);
  const mode = useWorkspaceStore((s) => s.mode);
  const explainLevel = useWorkspaceStore((s) => s.explainLevel);
  const setExplainLevel = useWorkspaceStore((s) => s.setExplainLevel);
  const isAgentLoading = useWorkspaceStore((s) => s.isAgentLoading);
  const setAgentLoading = useWorkspaceStore((s) => s.setAgentLoading);
  const addMessage = useWorkspaceStore((s) => s.addMessage);
  const addProposedChanges = useWorkspaceStore((s) => s.addProposedChanges);
  const errorLogDraft = useWorkspaceStore((s) => s.errorLogDraft);
  const setErrorLogDraft = useWorkspaceStore((s) => s.setErrorLogDraft);
  const getFileTreeString = useWorkspaceStore((s) => s.getFileTreeString);
  const getActiveFilePayload = useWorkspaceStore((s) => s.getActiveFilePayload);
  const rootName = useWorkspaceStore((s) => s.rootName);
  const openTabs = useWorkspaceStore((s) => s.openTabs);
  const files = useWorkspaceStore((s) => s.files);
  const setMobileTab = useWorkspaceStore((s) => s.setMobileTab);

  const [input, setInput] = useState("");
  const [showErrorBox, setShowErrorBox] = useState(mode === "debug");
  const [attachError, setAttachError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentLoading]);

  useEffect(() => {
    setShowErrorBox(mode === "debug");
  }, [mode]);

  const send = async () => {
    const text = input.trim();
    if (!text || isAgentLoading) return;

    const errorContext =
      attachError || mode === "debug"
        ? errorLogDraft.trim() || undefined
        : undefined;

    addMessage({
      role: "user",
      content: text,
      mode,
      context: {
        activeFile: getActiveFilePayload()?.path,
        errorLog: errorContext,
      },
    });
    setInput("");
    setAgentLoading(true);

    try {
      const payloadMessages = useWorkspaceStore
        .getState()
        .messages.filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-16)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          explainLevel,
          messages: payloadMessages,
          projectContext: {
            rootName,
            fileTree: getFileTreeString(),
            activeFile: getActiveFilePayload(),
            openFiles: openTabs.map((t) => t.path),
            fileContents: Object.fromEntries(
              openTabs.map((t) => {
                const f = findFile(files, t.path);
                return [t.path, f?.content ?? ""] as const;
              })
            ),
            recentErrors: errorContext,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as AgentChatResponse;

      addMessage({
        role: "assistant",
        content: data.content,
        mode,
        mocked: data.mocked,
        proposedChanges: data.proposedChanges,
      });

      if (data.proposedChanges?.length) {
        addProposedChanges(data.proposedChanges);
        setMobileTab("changes");
      }
    } catch (e) {
      addMessage({
        role: "assistant",
        content: `I could not complete that request: ${
          e instanceof Error ? e.message : "unknown error"
        }. Check the network connection or try again. The mock agent still works without \`XAI_API_KEY\`.`,
        mode,
        mocked: true,
      });
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-9 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-dim">
            Agent · {mode}
          </span>
        </div>
        {mode === "explain" && (
          <select
            value={explainLevel}
            onChange={(e) =>
              setExplainLevel(e.target.value as ExplainLevel)
            }
            className="rounded-md border border-border bg-bg px-2 py-0.5 text-[11px] text-text outline-none focus:ring-1 focus:ring-accent"
            aria-label="Explanation level"
          >
            {EXPLAIN_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-xl px-3 py-2.5",
              m.role === "user"
                ? "ml-6 bg-accent/15 border border-accent/20"
                : "mr-2 bg-surface-2 border border-border"
            )}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">
                {m.role === "user" ? "You" : "DevForge"}
              </span>
              {m.mode && m.role === "assistant" && (
                <Badge tone="muted">{m.mode}</Badge>
              )}
              {m.mocked && <Badge tone="warning">Mocked</Badge>}
              <span className="ml-auto text-[10px] text-text-dim">
                {formatTime(m.timestamp)}
              </span>
            </div>
            {m.role === "assistant" ? (
              <MarkdownLite content={m.content} />
            ) : (
              <p className="whitespace-pre-wrap text-[13px] text-text">
                {m.content}
              </p>
            )}
            {m.proposedChanges && m.proposedChanges.length > 0 && (
              <p className="mt-2 text-[11px] text-accent">
                {m.proposedChanges.length} proposed change
                {m.proposedChanges.length > 1 ? "s" : ""} → review in Changes
                panel
              </p>
            )}
          </div>
        ))}
        {isAgentLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            Thinking through the smallest correct change…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error log input */}
      {(showErrorBox || attachError) && (
        <div className="border-t border-border px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-warning">
            <AlertTriangle className="h-3 w-3" />
            Error / log paste
          </div>
          <textarea
            value={errorLogDraft}
            onChange={(e) => setErrorLogDraft(e.target.value)}
            placeholder="Paste stack traces, build errors, or terminal output…"
            rows={3}
            className="w-full resize-y rounded-lg border border-border bg-bg px-2.5 py-2 font-mono text-[11px] text-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
          />
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={
                mode === "build"
                  ? "Describe what you want to build…"
                  : mode === "debug"
                    ? "Describe the bug or paste the error…"
                    : mode === "review"
                      ? "What should I review?"
                      : mode === "test"
                        ? "What should we test?"
                        : "What should I explain?"
              }
              className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 pr-10 text-sm text-text outline-none placeholder:text-text-dim focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
              disabled={isAgentLoading}
            />
            <button
              type="button"
              title="Attach error log to next message"
              onClick={() => {
                setAttachError((v) => !v);
                setShowErrorBox(true);
              }}
              className={cn(
                "absolute bottom-2 right-2 rounded p-1",
                attachError
                  ? "text-warning"
                  : "text-text-dim hover:text-text-muted"
              )}
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="primary"
            onClick={() => void send()}
            disabled={!input.trim() || isAgentLoading}
            className="h-10 px-3"
          >
            {isAgentLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-text-dim">
          Enter to send · Shift+Enter for newline · One clear action at a time
        </p>
      </div>
    </div>
  );
}
