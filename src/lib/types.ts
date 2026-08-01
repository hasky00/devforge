/**
 * Core domain types for DevForge.
 * Designed so GitHub, real terminals, and extra runtimes can plug in later.
 */

export type AgentMode = "build" | "debug" | "review" | "explain" | "test";

export type ExplainLevel =
  | "beginner"
  | "technical"
  | "line-by-line"
  | "architecture";

export type FileNodeType = "file" | "folder";

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  type: FileNodeType;
  content?: string;
  language?: string;
  children?: ProjectFile[];
  /** Highlighted when the agent is discussing this file */
  agentFocus?: boolean;
}

export interface OpenTab {
  path: string;
  name: string;
  dirty: boolean;
  /** Line numbers modified in this session (1-based) */
  changedLines: number[];
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  mode?: AgentMode;
  timestamp: number;
  /** Structured proposed changes extracted from the reply */
  proposedChanges?: ProposedChange[];
  /** True when response came from the local mock agent */
  mocked?: boolean;
  /** Attachments / context snippets */
  context?: {
    activeFile?: string;
    errorLog?: string;
  };
}

export type ChangeStatus = "pending" | "accepted" | "rejected" | "edited";

export type DiffLineType = "add" | "remove" | "context";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ProposedChange {
  id: string;
  path: string;
  description: string;
  /** full | patch — prefer patch for small edits */
  kind: "create" | "modify" | "delete";
  originalContent: string;
  proposedContent: string;
  status: ChangeStatus;
  diff: DiffLine[];
}

export type TerminalLineLevel = "command" | "stdout" | "stderr" | "warning" | "info" | "success" | "error";

export interface TerminalLine {
  id: string;
  level: TerminalLineLevel;
  text: string;
  timestamp: number;
}

export interface TerminalEntry {
  id: string;
  command: string;
  lines: TerminalLine[];
  /** Only true when output explicitly confirms success */
  confirmedSuccess: boolean;
  /** Mocked vs future real sandbox */
  mocked: boolean;
  exitCode: number | null;
  startedAt: number;
  finishedAt: number | null;
}

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mode: AgentMode;
}

export interface ProjectSession {
  meta: SessionMeta;
  rootName: string;
  files: ProjectFile[];
  messages: ChatMessage[];
  terminal: TerminalEntry[];
  proposedChanges: ProposedChange[];
  openTabs: OpenTab[];
  activeFilePath: string | null;
  explainLevel: ExplainLevel;
}

export interface AgentChatRequest {
  mode: AgentMode;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  projectContext: {
    rootName: string;
    fileTree: string;
    activeFile?: { path: string; content: string; language?: string };
    openFiles?: string[];
    /** Path → content for open tabs (better diffs without full tree upload) */
    fileContents?: Record<string, string>;
    recentErrors?: string;
  };
  explainLevel?: ExplainLevel;
}

export interface AgentChatResponse {
  content: string;
  proposedChanges: ProposedChange[];
  mocked: boolean;
  model?: string;
}

/** Registry entry for pluggable language/framework support */
export interface TechSupport {
  id: string;
  name: string;
  category: "language" | "framework" | "database" | "tooling" | "deploy";
  extensions?: string[];
  enabled: boolean;
}
