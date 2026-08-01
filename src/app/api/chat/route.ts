import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { AgentChatRequest, AgentChatResponse } from "@/lib/types";
import { buildSystemPrompt } from "@/lib/agent/system-prompt";
import { runMockAgent } from "@/lib/agent/mock-agent";
import { parseProposedChanges } from "@/lib/agent/parse-changes";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/chat
 * Uses SpaceXAI (xAI) when XAI_API_KEY is set; otherwise the local mock agent.
 */
export async function POST(req: Request) {
  let body: AgentChatRequest | null = null;

  try {
    body = (await req.json()) as AgentChatRequest;

    if (!body?.messages?.length || !body.mode) {
      return NextResponse.json(
        { error: "messages and mode are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.XAI_API_KEY;

    if (!apiKey) {
      const mock = await runMockAgent(body);
      return NextResponse.json(mock satisfies AgentChatResponse);
    }

    const system = buildSystemPrompt(body.mode, body.explainLevel);
    const contextBlock = buildContextMessage(body);

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.x.ai/v1",
      timeout: 60_000,
    });

    const input = [
      { role: "system" as const, content: system },
      { role: "system" as const, content: contextBlock },
      ...body.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    const response = await client.responses.create({
      model: process.env.XAI_MODEL || "grok-4.5",
      input,
      store: false,
    });

    const content =
      (response as { output_text?: string }).output_text ??
      extractText(response);

    if (!content) {
      return NextResponse.json(
        { error: "Empty model response", mocked: false },
        { status: 502 }
      );
    }

    const fileMap = body.projectContext;
    const getOriginal = (path: string) => {
      if (fileMap.fileContents?.[path] != null) {
        return fileMap.fileContents[path];
      }
      if (fileMap.activeFile?.path === path) {
        return fileMap.activeFile.content;
      }
      return "";
    };

    const proposedChanges = parseProposedChanges(content, getOriginal);

    const result: AgentChatResponse = {
      content,
      proposedChanges,
      mocked: false,
      model: process.env.XAI_MODEL || "grok-4.5",
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/chat]", err);
    const message = err instanceof Error ? err.message : "Chat failed";

    if (body) {
      try {
        const mock = await runMockAgent(body);
        return NextResponse.json({
          ...mock,
          content:
            `> **Note:** Live model failed (${message}). Showing mock agent response.\n\n` +
            mock.content,
        } satisfies AgentChatResponse);
      } catch {
        /* fall through */
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildContextMessage(body: AgentChatRequest): string {
  const { projectContext } = body;
  const parts = [
    `## Project context`,
    `Root: ${projectContext.rootName}`,
    `File tree:\n\`\`\`\n${projectContext.fileTree}\n\`\`\``,
  ];
  if (projectContext.activeFile) {
    parts.push(
      `Active file: \`${projectContext.activeFile.path}\` (${projectContext.activeFile.language ?? "text"})\n\`\`\`\n${projectContext.activeFile.content.slice(0, 12000)}\n\`\`\``
    );
  }
  if (projectContext.openFiles?.length) {
    parts.push(`Open tabs: ${projectContext.openFiles.join(", ")}`);
  }
  if (projectContext.recentErrors) {
    parts.push(
      `Error / log paste:\n\`\`\`\n${projectContext.recentErrors.slice(0, 4000)}\n\`\`\``
    );
  }
  return parts.join("\n\n");
}

function extractText(response: unknown): string {
  const r = response as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  if (!r.output) return "";
  const chunks: string[] = [];
  for (const item of r.output) {
    if (item.type === "message" && item.content) {
      for (const c of item.content) {
        if (c.type === "output_text" && c.text) chunks.push(c.text);
        if (c.text) chunks.push(c.text);
      }
    }
  }
  return chunks.join("\n");
}
