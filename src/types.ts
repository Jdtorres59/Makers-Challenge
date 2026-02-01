export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  role: Role;
  content: string;
};

export type Intent =
  | "how_it_works"
  | "pricing"
  | "demo"
  | "use_cases"
  | "objections"
  | "general";

export type SourceSnippet = {
  title: string;
  excerpt: string;
  file: string;
};

export type CtaChip = {
  label: string;
  href?: string;
  kind: "primary" | "secondary" | "ghost" | "input";
  message?: string;
};

export type ChatResponse = {
  assistantText: string;
  sources: SourceSnippet[];
  intent: Intent;
  ctaChips: CtaChip[];
};
