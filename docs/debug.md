# Debugging

## Enable debug logs

Local:
```bash
DEBUG=true npm run dev
```

Optional prompt-length logs:
```bash
DEBUG=true DEBUG_PROMPT=true npm run dev
```

Vercel:
- Set env vars `DEBUG=true` (and optionally `DEBUG_PROMPT=true`) and redeploy.

## What to look for in logs

- `rag:missing_api_key` → falta `OPENAI_API_KEY`
- `rag:llm_error` with status 401/429 → auth o rate limit
- `rag:parse_failed` → el modelo no devolvió JSON válido
- `retrieve:start` with `filesCount=0` → no hay KB cargada
- `chat:response` with `usedFallback=true` + `fallbackReason`
