import type { TechSupport } from "./types";

/**
 * Supported technologies for v1.
 * Add entries here to extend language/framework coverage without rewriting the agent core.
 */
export const TECH_REGISTRY: TechSupport[] = [
  { id: "javascript", name: "JavaScript", category: "language", extensions: [".js", ".mjs", ".cjs"], enabled: true },
  { id: "typescript", name: "TypeScript", category: "language", extensions: [".ts", ".tsx"], enabled: true },
  { id: "python", name: "Python", category: "language", extensions: [".py"], enabled: true },
  { id: "html", name: "HTML", category: "language", extensions: [".html"], enabled: true },
  { id: "css", name: "CSS", category: "language", extensions: [".css"], enabled: true },
  { id: "react", name: "React", category: "framework", enabled: true },
  { id: "nextjs", name: "Next.js", category: "framework", enabled: true },
  { id: "nodejs", name: "Node.js", category: "framework", enabled: true },
  { id: "fastapi", name: "FastAPI", category: "framework", enabled: true },
  { id: "tailwind", name: "Tailwind CSS", category: "framework", enabled: true },
  { id: "rest", name: "REST APIs", category: "framework", enabled: true },
  { id: "websockets", name: "WebSockets", category: "framework", enabled: true },
  { id: "sqlite", name: "SQLite", category: "database", extensions: [".sqlite", ".db"], enabled: true },
  { id: "postgresql", name: "PostgreSQL", category: "database", enabled: true },
  { id: "git", name: "Git", category: "tooling", enabled: true },
  { id: "github", name: "GitHub", category: "tooling", enabled: true },
  { id: "docker", name: "Docker", category: "tooling", enabled: true },
  { id: "vercel", name: "Vercel", category: "deploy", enabled: true },
];

export function enabledTechNames(): string[] {
  return TECH_REGISTRY.filter((t) => t.enabled).map((t) => t.name);
}
