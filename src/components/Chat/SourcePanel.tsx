"use client";

import type { SourceSnippet } from "@/types";

type SourcePanelProps = {
  sources?: SourceSnippet[];
};

export default function SourcePanel({ sources }: SourcePanelProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <details className="source-panel">
      <summary>Ver fuentes</summary>
      <div className="source-list">
        {sources.map((source, index) => (
          <div className="source-card" key={`${source.file}-${index}`}>
            <div className="source-title">{source.title}</div>
            <div>{source.excerpt}</div>
            <div className="source-file">{source.file}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
