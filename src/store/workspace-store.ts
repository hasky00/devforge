"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  AgentMode,
  ChatMessage,
  ExplainLevel,
  OpenTab,
  ProjectFile,
  ProposedChange,
  TerminalEntry,
} from "@/lib/types";
import {
  createSampleProject,
  SAMPLE_ERROR_LOG,
  SAMPLE_PROJECT_NAME,
  WELCOME_MESSAGE,
} from "@/lib/project/sample-project";
import {
  createFile,
  deleteNode,
  findFile,
  renameNode,
  renderFileTree,
  setAgentFocus,
  updateFileContent,
  upsertFile,
} from "@/lib/project/file-tree";
import { buildDiff, changedLineNumbers } from "@/lib/diff";
import { basename } from "@/lib/utils";

interface WorkspaceState {
  rootName: string;
  files: ProjectFile[];
  openTabs: OpenTab[];
  activeFilePath: string | null;
  messages: ChatMessage[];
  mode: AgentMode;
  explainLevel: ExplainLevel;
  terminal: TerminalEntry[];
  proposedChanges: ProposedChange[];
  errorLogDraft: string;
  isAgentLoading: boolean;
  agentFocusPath: string | null;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  bottomCollapsed: boolean;
  mobileTab: "files" | "editor" | "chat" | "terminal" | "changes";
  sessionId: string;

  // File ops
  openFile: (path: string) => void;
  closeTab: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateActiveContent: (content: string) => void;
  saveActiveFile: () => void;
  createNewFile: (parentPath: string | null, name: string, type: "file" | "folder") => void;
  deleteFile: (path: string) => void;
  renameFile: (path: string, newName: string) => void;
  setAgentFocusPath: (path: string | null) => void;

  // Chat / agent
  setMode: (mode: AgentMode) => void;
  setExplainLevel: (level: ExplainLevel) => void;
  addMessage: (msg: Omit<ChatMessage, "id" | "timestamp">) => void;
  setAgentLoading: (v: boolean) => void;
  setErrorLogDraft: (v: string) => void;
  clearChat: () => void;

  // Changes
  addProposedChanges: (changes: ProposedChange[]) => void;
  acceptChange: (id: string) => void;
  rejectChange: (id: string) => void;
  updateChangeContent: (id: string, content: string) => void;
  clearResolvedChanges: () => void;

  // Terminal
  pushTerminalEntry: (entry: TerminalEntry) => void;
  clearTerminal: () => void;

  // Layout
  setLeftCollapsed: (v: boolean) => void;
  setRightCollapsed: (v: boolean) => void;
  setBottomCollapsed: (v: boolean) => void;
  setMobileTab: (t: WorkspaceState["mobileTab"]) => void;

  // Session
  resetProject: () => void;
  getFileTreeString: () => string;
  getActiveFilePayload: () => { path: string; content: string; language?: string } | undefined;
}

function welcomeMessages(): ChatMessage[] {
  return [
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      // Fixed timestamp avoids hydration mismatch if this ever SSR-renders
      timestamp: 0,
      mocked: false,
    },
  ];
}

function initialFiles(): ProjectFile[] {
  return createSampleProject();
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      rootName: SAMPLE_PROJECT_NAME,
      files: initialFiles(),
      openTabs: [],
      activeFilePath: null,
      messages: welcomeMessages(),
      mode: "debug",
      explainLevel: "beginner",
      terminal: [],
      proposedChanges: [],
      errorLogDraft: SAMPLE_ERROR_LOG,
      isAgentLoading: false,
      agentFocusPath: null,
      leftCollapsed: false,
      rightCollapsed: false,
      bottomCollapsed: false,
      mobileTab: "chat",
      // Stable default; real id is set on client after rehydrate / first interaction
      sessionId: "pending",

      openFile: (path) => {
        const file = findFile(get().files, path);
        if (!file || file.type !== "file") return;
        set((s) => {
          const exists = s.openTabs.some((t) => t.path === path);
          const openTabs = exists
            ? s.openTabs
            : [
                ...s.openTabs,
                {
                  path,
                  name: file.name,
                  dirty: false,
                  changedLines: [],
                },
              ];
          return {
            openTabs,
            activeFilePath: path,
            files: setAgentFocus(s.files, path),
            agentFocusPath: path,
          };
        });
      },

      closeTab: (path) => {
        set((s) => {
          const openTabs = s.openTabs.filter((t) => t.path !== path);
          let activeFilePath = s.activeFilePath;
          if (activeFilePath === path) {
            activeFilePath = openTabs.length
              ? openTabs[openTabs.length - 1].path
              : null;
          }
          return { openTabs, activeFilePath };
        });
      },

      setActiveFile: (path) => {
        set((s) => ({
          activeFilePath: path,
          files: setAgentFocus(s.files, path),
          agentFocusPath: path,
        }));
      },

      updateActiveContent: (content) => {
        const path = get().activeFilePath;
        if (!path) return;
        set((s) => ({
          files: updateFileContent(s.files, path, content),
          openTabs: s.openTabs.map((t) =>
            t.path === path ? { ...t, dirty: true } : t
          ),
        }));
      },

      saveActiveFile: () => {
        const path = get().activeFilePath;
        if (!path) return;
        set((s) => ({
          openTabs: s.openTabs.map((t) =>
            t.path === path ? { ...t, dirty: false } : t
          ),
        }));
      },

      createNewFile: (parentPath, name, type) => {
        set((s) => {
          const files = createFile(s.files, parentPath, name, type);
          return { files };
        });
        if (type === "file") {
          const path = parentPath ? `${parentPath}/${name}` : name;
          get().openFile(path);
        }
      },

      deleteFile: (path) => {
        set((s) => ({
          files: deleteNode(s.files, path),
          openTabs: s.openTabs.filter(
            (t) => t.path !== path && !t.path.startsWith(path + "/")
          ),
          activeFilePath:
            s.activeFilePath === path ||
            s.activeFilePath?.startsWith(path + "/")
              ? null
              : s.activeFilePath,
          proposedChanges: s.proposedChanges.filter(
            (c) => c.path !== path && !c.path.startsWith(path + "/")
          ),
        }));
      },

      renameFile: (path, newName) => {
        set((s) => {
          const files = renameNode(s.files, path, newName);
          const parent = path.includes("/")
            ? path.slice(0, path.lastIndexOf("/"))
            : "";
          const newPath = parent ? `${parent}/${newName}` : newName;
          const openTabs = s.openTabs.map((t) => {
            if (t.path === path) {
              return { ...t, path: newPath, name: newName };
            }
            if (t.path.startsWith(path + "/")) {
              const np = t.path.replace(path, newPath);
              return { ...t, path: np, name: basename(np) };
            }
            return t;
          });
          const activeFilePath =
            s.activeFilePath === path
              ? newPath
              : s.activeFilePath?.startsWith(path + "/")
                ? s.activeFilePath.replace(path, newPath)
                : s.activeFilePath;
          return { files, openTabs, activeFilePath };
        });
      },

      setAgentFocusPath: (path) => {
        set((s) => ({
          agentFocusPath: path,
          files: setAgentFocus(s.files, path),
        }));
      },

      setMode: (mode) => set({ mode }),
      setExplainLevel: (explainLevel) => set({ explainLevel }),

      addMessage: (msg) => {
        set((s) => ({
          messages: [
            ...s.messages,
            { ...msg, id: nanoid(), timestamp: Date.now() },
          ],
        }));
      },

      setAgentLoading: (isAgentLoading) => set({ isAgentLoading }),
      setErrorLogDraft: (errorLogDraft) => set({ errorLogDraft }),

      clearChat: () => set({ messages: welcomeMessages() }),

      addProposedChanges: (changes) => {
        set((s) => ({
          proposedChanges: [
            ...s.proposedChanges.filter((c) => c.status === "pending"),
            ...changes,
          ],
        }));
        const first = changes[0];
        if (first) get().setAgentFocusPath(first.path);
      },

      acceptChange: (id) => {
        const change = get().proposedChanges.find((c) => c.id === id);
        if (
          !change ||
          (change.status !== "pending" && change.status !== "edited")
        )
          return;

        set((s) => {
          let files = s.files;
          let openTabs = s.openTabs;

          if (change.kind === "delete") {
            files = deleteNode(files, change.path);
            openTabs = openTabs.filter((t) => t.path !== change.path);
          } else {
            files = upsertFile(files, change.path, change.proposedContent);
            const changed = changedLineNumbers(
              change.originalContent,
              change.proposedContent
            );
            const name = basename(change.path);
            const tab = openTabs.find((t) => t.path === change.path);
            if (tab) {
              openTabs = openTabs.map((t) =>
                t.path === change.path
                  ? { ...t, dirty: false, changedLines: changed }
                  : t
              );
            } else {
              openTabs = [
                ...openTabs,
                {
                  path: change.path,
                  name,
                  dirty: false,
                  changedLines: changed,
                },
              ];
            }
          }

          return {
            files,
            openTabs,
            activeFilePath:
              change.kind === "delete"
                ? s.activeFilePath === change.path
                  ? null
                  : s.activeFilePath
                : change.path,
            proposedChanges: s.proposedChanges.map((c) =>
              c.id === id ? { ...c, status: "accepted" as const } : c
            ),
          };
        });
      },

      rejectChange: (id) => {
        set((s) => ({
          proposedChanges: s.proposedChanges.map((c) =>
            c.id === id ? { ...c, status: "rejected" as const } : c
          ),
        }));
      },

      updateChangeContent: (id, content) => {
        set((s) => ({
          proposedChanges: s.proposedChanges.map((c) => {
            if (c.id !== id) return c;
            return {
              ...c,
              proposedContent: content,
              status: "edited" as const,
              diff: buildDiff(c.originalContent, content),
            };
          }),
        }));
      },

      clearResolvedChanges: () => {
        set((s) => ({
          proposedChanges: s.proposedChanges.filter(
            (c) => c.status === "pending" || c.status === "edited"
          ),
        }));
      },

      pushTerminalEntry: (entry) => {
        set((s) => ({ terminal: [...s.terminal, entry] }));
      },

      clearTerminal: () => set({ terminal: [] }),

      setLeftCollapsed: (leftCollapsed) => set({ leftCollapsed }),
      setRightCollapsed: (rightCollapsed) => set({ rightCollapsed }),
      setBottomCollapsed: (bottomCollapsed) => set({ bottomCollapsed }),
      setMobileTab: (mobileTab) => set({ mobileTab }),

      resetProject: () => {
        set({
          rootName: SAMPLE_PROJECT_NAME,
          files: initialFiles(),
          openTabs: [],
          activeFilePath: null,
          messages: welcomeMessages(),
          mode: "debug",
          terminal: [],
          proposedChanges: [],
          errorLogDraft: SAMPLE_ERROR_LOG,
          agentFocusPath: null,
          sessionId: nanoid(),
        });
      },

      getFileTreeString: () => renderFileTree(get().files),

      getActiveFilePayload: () => {
        const path = get().activeFilePath;
        if (!path) return undefined;
        const f = findFile(get().files, path);
        if (!f || f.type !== "file") return undefined;
        return {
          path: f.path,
          content: f.content ?? "",
          language: f.language,
        };
      },
    }),
    {
      name: "devforge-workspace",
      partialize: (s) => ({
        rootName: s.rootName,
        files: s.files,
        openTabs: s.openTabs,
        activeFilePath: s.activeFilePath,
        messages: s.messages,
        mode: s.mode,
        explainLevel: s.explainLevel,
        proposedChanges: s.proposedChanges.filter(
          (c) => c.status === "pending" || c.status === "edited"
        ),
        errorLogDraft: s.errorLogDraft,
        sessionId: s.sessionId,
      }),
      onRehydrateStorage: () => (state) => {
        // Ensure a real session id exists once we are on the client
        if (state && (!state.sessionId || state.sessionId === "pending")) {
          state.sessionId = nanoid();
        }
      },
    }
  )
);
