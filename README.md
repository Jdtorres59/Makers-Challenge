# Camaral Sales/Support Assistant (Skeleton)

## ¿Qué es?
Un esqueleto en Next.js (App Router + TypeScript) para un chatbot de ventas/soporte de Camaral. Incluye UI de chat, endpoint `/api/chat`, retrieval simple de snippets y chips dinámicos por intención.

## Cómo correr local
```bash
npm install
npm run dev
```

## Variables de entorno
```bash
OPENAI_API_KEY=tu_api_key
OPENAI_MODEL=gpt-4o-mini
```

## Cómo funciona
- `retrieve()` lee `src/knowledge/*.md` y selecciona 3–5 snippets relevantes.
- `detectIntent()` clasifica intención con reglas/keywords (con fallback opcional a LLM).
- `rag.ts` construye el prompt con snippets y conversa con OpenAI para generar la respuesta.
- El endpoint `/api/chat` devuelve:
  - `assistantText`
  - `sources`
  - `intent`
  - `ctaChips`
- En la UI, `IntentChips` renderiza los chips del backend (o fallback por intención).

## Limitaciones (honestas)
- El buscador es simple (keyword matching, sin embeddings).
- Dependemos de OpenAI para la generación; si falla, se usa fallback seguro.
- La base de conocimiento es mínima y tiene datos “por confirmar”.

## Cómo cambiar los links oficiales
Edita `src/constants/links.ts` y reemplaza las URLs por las oficiales.
