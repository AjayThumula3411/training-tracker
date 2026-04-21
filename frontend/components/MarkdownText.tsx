"use client";

import { Fragment, ReactNode } from "react";

type MarkdownTextProps = {
  content: string;
  className?: string;
};

const parseInline = (text: string): ReactNode[] => {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        return (
          <a
            key={`${part}-${index}`}
            href={match[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-4"
          >
            {match[1]}
          </a>
        );
      }
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={`${part}-${index}`}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
};

export default function MarkdownText({ content, className = "" }: MarkdownTextProps) {
  const lines = content.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (keyBase: string) => {
    if (listItems.length === 0) return;

    elements.push(
      <ul key={`${keyBase}-list`} className="markdown-list">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{parseInline(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList(`line-${index}`);
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2).trim());
      return;
    }

    flushList(`line-${index}`);

    if (trimmed.startsWith(">")) {
      elements.push(
        <blockquote key={`quote-${index}`} className="markdown-quote">
          {parseInline(trimmed.replace(/^>\s?/, ""))}
        </blockquote>
      );
      return;
    }

    elements.push(
      <p key={`paragraph-${index}`} className="markdown-paragraph">
        {parseInline(trimmed)}
      </p>
    );
  });

  flushList("final");

  return <div className={`markdown-body ${className}`.trim()}>{elements}</div>;
}
