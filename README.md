# TALQS prototype

TALQS is a narrow research prototype for Indian consumer-dispute judgments. It
uses a curated local corpus, deterministic retrieval, visible source passages,
and explicit no-answer rules. It is an educational tool and does not provide
legal advice.

Public demo: https://talqs.talqs-prototype.workers.dev

## Current scope

- 11 curated online-shopping and defective-product consumer orders
- source-linked summaries and four supported question types
- authenticated private PDF, TXT, and Markdown libraries through Supabase
- 384-dimensional `gte-small` embeddings generated in Supabase Edge Functions
- pgvector cosine retrieval scoped to the document owner through RLS
- paragraph, sentence-window, fixed-window, and curated chunking
- keyword, BM25, TF-IDF cosine, and hybrid retrieval
- configurable top-k and support threshold
- retrieval comparison, prompt inspection, payloads, timing, and token estimates
- deterministic fallback when intent or retrieval support is insufficient
- encrypted, reusable provider credentials or explicit one-time keys
- optional model calls through an allowlisted same-origin proxy

The curated workflow does not call an LLM. Signed-in document uploads are stored
in Supabase and remain available after reload. Scanned PDFs require OCR before
upload.

## Request flow

1. Classify the question into facts, outcome, remedy, law, or unsupported.
2. Chunk the selected record with the active strategy.
3. Score chunks with the active retriever.
4. Compare the top score with the support threshold.
5. Return a deterministic answer or the no-answer fallback.
6. Optionally send the grounded prompt to an allowlisted provider with a
   user-supplied session key.
7. Reject model output that cites chunk IDs outside the retrieved context.

## API key handling

Provider keys can be used once or saved to the user's private credential vault.
Saved keys are encrypted with AES-256-GCM before database insertion. The
encryption key is a server-only environment variable. The browser receives only
credential metadata and the final four key characters. Provider keys are never
written to application logs.

The proxy accepts OpenAI, Groq, OpenRouter, Google Gemini, and Anthropic Claude.
Provider names, model IDs, prompt size, key format, and request size are
validated before the outbound request. Each provider uses a fixed official
endpoint; users cannot supply an arbitrary destination URL.

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the Supabase project. Generate the
credential-vault secret with `openssl rand -base64 32` and set the result as
`TALQS_KEY_ENCRYPTION_SECRET`. Set `SUPABASE_SECRET_KEY` only in the server
environment; it is never exposed through a `NEXT_PUBLIC_` variable. Do not
commit `.env.local`.

Validation:

```bash
npm run lint
npm test
npm audit --omit=dev
```

Cloudflare deployment:

```bash
npm run deploy:cloudflare
```

## Database

The schema is in `supabase/migrations`. Every exposed table has row-level
security and explicit grants. `documents`, `document_chunks`, and
`documents` and `document_chunks` are restricted by `auth.uid()`.
`provider_credentials` has no browser-role grants and is reachable only through
authenticated server routes using the server-only Supabase secret key. The
semantic search function is security-invoker and filters by the authenticated
owner before ranking chunks.

OCR jobs remain outside this prototype.
