import type { ProjectFile } from "../types";
import { languageFromPath } from "../utils";
import { nanoid } from "nanoid";

export function flattenFiles(nodes: ProjectFile[]): ProjectFile[] {
  const out: ProjectFile[] = [];
  const walk = (list: ProjectFile[]) => {
    for (const n of list) {
      out.push(n);
      if (n.children) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function findFile(nodes: ProjectFile[], path: string): ProjectFile | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.children) {
      const found = findFile(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

export function updateFileContent(
  nodes: ProjectFile[],
  path: string,
  content: string
): ProjectFile[] {
  return nodes.map((n) => {
    if (n.path === path && n.type === "file") {
      return { ...n, content };
    }
    if (n.children) {
      return { ...n, children: updateFileContent(n.children, path, content) };
    }
    return n;
  });
}

export function setAgentFocus(
  nodes: ProjectFile[],
  path: string | null
): ProjectFile[] {
  return nodes.map((n) => {
    const focused = path != null && n.path === path;
    if (n.children) {
      return {
        ...n,
        agentFocus: focused,
        children: setAgentFocus(n.children, path),
      };
    }
    return { ...n, agentFocus: focused };
  });
}

export function deleteNode(nodes: ProjectFile[], path: string): ProjectFile[] {
  return nodes
    .filter((n) => n.path !== path)
    .map((n) =>
      n.children ? { ...n, children: deleteNode(n.children, path) } : n
    );
}

export function renameNode(
  nodes: ProjectFile[],
  path: string,
  newName: string
): ProjectFile[] {
  return nodes.map((n) => {
    if (n.path === path) {
      const parent = path.includes("/")
        ? path.slice(0, path.lastIndexOf("/"))
        : "";
      const newPath = parent ? `${parent}/${newName}` : newName;
      const renamed: ProjectFile = {
        ...n,
        name: newName,
        path: newPath,
        language: n.type === "file" ? languageFromPath(newPath) : undefined,
      };
      if (renamed.children) {
        renamed.children = remapChildrenPaths(renamed.children, path, newPath);
      }
      return renamed;
    }
    if (n.children) {
      return { ...n, children: renameNode(n.children, path, newName) };
    }
    return n;
  });
}

function remapChildrenPaths(
  children: ProjectFile[],
  oldPrefix: string,
  newPrefix: string
): ProjectFile[] {
  return children.map((c) => {
    const newPath = c.path.replace(oldPrefix, newPrefix);
    return {
      ...c,
      path: newPath,
      language: c.type === "file" ? languageFromPath(newPath) : undefined,
      children: c.children
        ? remapChildrenPaths(c.children, oldPrefix, newPrefix)
        : undefined,
    };
  });
}

export function createFile(
  nodes: ProjectFile[],
  parentPath: string | null,
  name: string,
  type: "file" | "folder",
  content = ""
): ProjectFile[] {
  const path = parentPath ? `${parentPath}/${name}` : name;
  const node: ProjectFile = {
    id: nanoid(),
    name,
    path,
    type,
    content: type === "file" ? content : undefined,
    language: type === "file" ? languageFromPath(path) : undefined,
    children: type === "folder" ? [] : undefined,
  };

  if (!parentPath) {
    return [...nodes, node];
  }

  const insert = (list: ProjectFile[]): ProjectFile[] =>
    list.map((n) => {
      if (n.path === parentPath && n.type === "folder") {
        return { ...n, children: [...(n.children ?? []), node] };
      }
      if (n.children) {
        return { ...n, children: insert(n.children) };
      }
      return n;
    });

  return insert(nodes);
}

export function upsertFile(
  nodes: ProjectFile[],
  path: string,
  content: string
): ProjectFile[] {
  const existing = findFile(nodes, path);
  if (existing) {
    return updateFileContent(nodes, path, content);
  }

  const parts = path.split("/");
  const name = parts.pop()!;
  const parentPath = parts.length ? parts.join("/") : null;
  const withFolders = ensureFolderPath(nodes, parts);
  return createFile(withFolders, parentPath, name, "file", content);
}

function ensureFolderPath(nodes: ProjectFile[], parts: string[]): ProjectFile[] {
  let result = nodes;
  let path = "";
  for (const part of parts) {
    path = path ? `${path}/${part}` : part;
    if (!findFile(result, path)) {
      const parent = path.includes("/")
        ? path.slice(0, path.lastIndexOf("/"))
        : null;
      result = createFile(result, parent, part, "folder");
    }
  }
  return result;
}

/** ASCII file tree for agent context */
export function renderFileTree(nodes: ProjectFile[], prefix = ""): string {
  const lines: string[] = [];
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  sorted.forEach((n, i) => {
    const isLast = i === sorted.length - 1;
    const branch = isLast ? "└── " : "├── ";
    lines.push(`${prefix}${branch}${n.name}${n.type === "folder" ? "/" : ""}`);
    if (n.children?.length) {
      const next = prefix + (isLast ? "    " : "│   ");
      lines.push(renderFileTree(n.children, next));
    }
  });

  return lines.join("\n");
}
