"use client";

/**
 * Lightweight markdown renderer for agent messages.
 * Supports headings, bold, italic, lists, code blocks, inline code, blockquotes.
 */
export function MarkdownLite({ content }: { content: string }) {
  const blocks = splitBlocks(content);

  return (
    <div className="markdown-lite space-y-2.5 text-[13px] leading-relaxed text-text">
      {blocks.map((block, i) => {
        if (block.type === "code") {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-lg border border-border bg-bg px-3 py-2.5 font-mono text-[12px] text-text-muted"
            >
              {block.lang && (
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-text-dim">
                  {block.lang}
                </div>
              )}
              <code>{block.value}</code>
            </pre>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote
              key={i}
              className="border-l-2 border-accent/50 pl-3 text-text-muted italic"
            >
              {renderInline(block.value)}
            </blockquote>
          );
        }
        if (block.type === "heading") {
          const sizes = [
            "",
            "text-base font-semibold",
            "text-sm font-semibold",
            "text-sm font-medium",
          ];
          const className = `${sizes[block.level] ?? sizes[3]} text-text mt-1`;
          if (block.level === 1) {
            return (
              <h1 key={i} className={className}>
                {renderInline(block.value)}
              </h1>
            );
          }
          if (block.level === 2) {
            return (
              <h2 key={i} className={className}>
                {renderInline(block.value)}
              </h2>
            );
          }
          return (
            <h3 key={i} className={className}>
              {renderInline(block.value)}
            </h3>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 text-text-muted">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "olist") {
          return (
            <ol
              key={i}
              className="list-decimal space-y-1 pl-5 text-text-muted"
            >
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className="text-text-muted whitespace-pre-wrap">
            {renderInline(block.value)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // code, bold, italic
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    const token = m[0];
    if (token.startsWith("`")) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-accent"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-text">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*")) {
      parts.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type Block =
  | { type: "paragraph"; value: string }
  | { type: "heading"; level: number; value: string }
  | { type: "code"; lang?: string; value: string }
  | { type: "quote"; value: string }
  | { type: "list"; items: string[] }
  | { type: "olist"; items: string[] };

function splitBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || undefined;
      // Skip machine-readable change blocks from display (shown in Changes panel)
      if (lang === "devforge-change") {
        i++;
        while (i < lines.length && !lines[i].startsWith("```")) i++;
        i++;
        continue;
      }
      i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", lang, value: code.join("\n") });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        value: heading[2],
      });
      i++;
      continue;
    }

    if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quote.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "quote", value: quote.join(" ") });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "olist", items });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith("> ") &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", value: para.join("\n") });
  }

  return blocks;
}
