"use client";

/**
 * Minimal, dependency-free Markdown renderer for Kai chat replies.
 *
 * Security: the source is HTML-escaped FIRST, so no raw markup from the model
 * (or anything upstream) can inject elements. Only a small, known set of inline
 * and block constructs are then re-introduced as safe markup. Links are forced
 * to rel="noopener noreferrer" and http(s)/relative hrefs only.
 */

import { Fragment, type ReactNode } from "react";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Apply inline formatting to an already HTML-escaped string → HTML string. */
function inline(escaped: string): string {
  let out = escaped;
  // inline code
  out = out.replace(/`([^`]+)`/g, '<code class="kai-code">$1</code>');
  // bold then italic
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  // links [text](url) — only safe schemes
  out = out.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g,
    (_m, txt, href) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer" class="kai-link">${txt}</a>`
  );
  return out;
}

interface Node {
  key: string;
  html: string;
  tag: "p" | "h3" | "h4" | "li-ul" | "li-ol" | "pre";
}

function parse(src: string): Node[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const nodes: Node[] = [];
  let i = 0;
  let k = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      nodes.push({ key: `p${k++}`, tag: "p", html: inline(escapeHtml(para.join(" "))) });
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    if (line.trim().startsWith("```")) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      nodes.push({ key: `pre${k++}`, tag: "pre", html: escapeHtml(code.join("\n")) });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      const tag = h[1].length <= 3 ? "h3" : "h4";
      nodes.push({ key: `h${k++}`, tag, html: inline(escapeHtml(h[2])) });
      i++;
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushPara();
      nodes.push({ key: `ul${k++}`, tag: "li-ul", html: inline(escapeHtml(ul[1])) });
      i++;
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushPara();
      nodes.push({ key: `ol${k++}`, tag: "li-ol", html: inline(escapeHtml(ol[1])) });
      i++;
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return nodes;
}

export default function Markdown({ text }: { text: string }) {
  const nodes = parse(text || "");
  const out: ReactNode[] = [];
  let listBuf: Node[] = [];
  let listTag: "li-ul" | "li-ol" | null = null;

  const flushList = () => {
    if (!listBuf.length || !listTag) return;
    const items = listBuf.map((n) => (
      <li key={n.key} dangerouslySetInnerHTML={{ __html: n.html }} />
    ));
    out.push(
      listTag === "li-ul" ? (
        <ul key={`ul-${listBuf[0].key}`} className="my-1.5 ml-4 list-disc space-y-1">
          {items}
        </ul>
      ) : (
        <ol key={`ol-${listBuf[0].key}`} className="my-1.5 ml-4 list-decimal space-y-1">
          {items}
        </ol>
      )
    );
    listBuf = [];
    listTag = null;
  };

  for (const n of nodes) {
    if (n.tag === "li-ul" || n.tag === "li-ol") {
      if (listTag && listTag !== n.tag) flushList();
      listTag = n.tag;
      listBuf.push(n);
      continue;
    }
    flushList();
    if (n.tag === "p")
      out.push(<p key={n.key} className="my-1.5 leading-relaxed" dangerouslySetInnerHTML={{ __html: n.html }} />);
    else if (n.tag === "h3")
      out.push(<h3 key={n.key} className="mt-3 mb-1 font-display text-base font-bold text-ink" dangerouslySetInnerHTML={{ __html: n.html }} />);
    else if (n.tag === "h4")
      out.push(<h4 key={n.key} className="mt-2.5 mb-1 font-display text-sm font-bold text-ink" dangerouslySetInnerHTML={{ __html: n.html }} />);
    else if (n.tag === "pre")
      out.push(
        <pre key={n.key} className="my-2 overflow-x-auto rounded-lg bg-paper p-3 text-xs">
          <code>{n.html.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")}</code>
        </pre>
      );
  }
  flushList();

  return <Fragment>{out}</Fragment>;
}
