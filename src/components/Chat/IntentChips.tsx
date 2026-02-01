"use client";

import { links } from "@/constants/links";
import type { CtaChip, Intent } from "@/types";

type IntentChipsProps = {
  intent: Intent;
  ctaChips?: CtaChip[];
  onChipMessage: (message: string) => void;
};

const fallbackChips: Record<Intent, CtaChip[]> = {
  how_it_works: [
    { label: "Ver casos de uso", href: links.useCases, kind: "primary" },
    { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
  ],
  pricing: [
    { label: "Ver precios", href: links.pricing, kind: "primary" },
    { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
  ],
  demo: [
    { label: "Agendar demo", href: links.bookDemo, kind: "primary" },
    { label: "Hablar con ventas", kind: "input", message: "Quiero hablar con ventas." },
  ],
  use_cases: [
    { label: "Ver casos de uso", href: links.useCases, kind: "primary" },
    { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
  ],
  objections: [
    {
      label: "Resolver objeciones",
      kind: "input",
      message: "Tengo algunas objeciones y dudas sobre adopción. ¿Podemos revisarlas?",
    },
    { label: "Agendar demo", href: links.bookDemo, kind: "secondary" },
  ],
  general: [
    { label: "¿Qué es Camaral?", kind: "input", message: "¿Qué es Camaral?" },
    { label: "¿Cómo funciona?", kind: "input", message: "¿Cómo funciona Camaral?" },
    { label: "Precios", href: links.pricing, kind: "secondary" },
    { label: "Agendar demo", href: links.bookDemo, kind: "primary" },
  ],
};

export default function IntentChips({ intent, ctaChips, onChipMessage }: IntentChipsProps) {
  const chips = ctaChips && ctaChips.length > 0 ? ctaChips : fallbackChips[intent];

  if (!chips || chips.length === 0) return null;

  return (
    <div className="chips">
      {chips.map((chip, index) => {
        const className = `chip ${chip.kind}`;

        if (chip.href) {
          return (
            <a
              key={`${chip.label}-${index}`}
              className={className}
              href={chip.href}
              target="_blank"
              rel="noreferrer"
            >
              {chip.label}
            </a>
          );
        }

        return (
          <button
            key={`${chip.label}-${index}`}
            type="button"
            className={className}
            onClick={() => {
              if (chip.message) onChipMessage(chip.message);
            }}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}
