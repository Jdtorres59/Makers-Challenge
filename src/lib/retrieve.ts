import fs from "fs/promises";
import path from "path";
import { normalizeText, splitParagraphs, truncate } from "@/lib/format";
import type { SourceSnippet } from "@/types";

// Simple keyword-based retrieval (no embeddings) to keep the skeleton lightweight.
const KNOWLEDGE_DIR = path.join(process.cwd(), "src", "knowledge");

type ScoredParagraph = {
  text: string;
  score: number;
  title: string;
  file: string;
};

function extractTitle(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1];
  return heading?.trim() || fallback.replace(/_/g, " ");
}

function tokenize(query: string): string[] {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length > 2);
}

function scoreParagraph(text: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const normalized = normalizeText(text);
  let score = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) score += 1;
  }
  return score;
}

export async function retrieve(query: string, limit = 5): Promise<SourceSnippet[]> {
  const files = await fs.readdir(KNOWLEDGE_DIR);
  const mdFiles = files.filter((file) => file.endsWith(".md"));
  const tokens = tokenize(query);
  const scored: ScoredParagraph[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(KNOWLEDGE_DIR, file);
    const content = await fs.readFile(filePath, "utf8");
    const title = extractTitle(content, file.replace(".md", ""));
    const paragraphs = splitParagraphs(content.replace(/^#.+$/gm, ""));

    for (const paragraph of paragraphs) {
      const score = scoreParagraph(paragraph, tokens);
      if (score > 0 || tokens.length === 0) {
        scored.push({
          text: paragraph,
          score,
          title,
          file,
        });
      }
    }
  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);

  const trimmed = scored.slice(0, limit);
  return trimmed.map((item) => ({
    title: item.title,
    excerpt: truncate(item.text),
    file: item.file,
  }));
}
