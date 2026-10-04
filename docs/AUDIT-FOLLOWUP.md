# PDF audit follow-up — RAG Lens

Scope: portfolio audit pages 27–28, reviewed 2026-10-04.

| Finding | Change and evidence |
| --- | --- |
| Windows build and dependency drift | Resolve Vite with Node, repair lockfile, update affected transitive dependencies, test actual wrapper invocation and clean Windows/Ubuntu CI builds. |
| Tests only covered shared scaffolding | Domain tests cover chunk offsets/overlap, TF-IDF and BM25, zero-overlap queries, MMR, document identity, number grounding and provider failures. All test files are explicitly discovered across platforms. |
| Stale answer risk | Fingerprints include the entire document and all retrieval inputs, so equal-length edits in the middle invalidate old answers. |
| Misleading retrieved evidence | Zero-score chunks no longer pad Top-K; single-digit facts count; citation numbers are excluded; a number prefix does not count as an exact matching fact. Grounding remains a lexical heuristic. |
| Provider failure/prompt/cost gaps | Validate inputs and sizes; 20-second abort per call; maximum 360 output tokens; process-local ceiling of 20 calls/hour including failures; no-evidence RAG uses a local refusal; unknown citations, empty/truncated/malformed output and provider errors fail visibly. Retrieved text is marked untrusted in the system prompt. |
| Missing install assets | Restore the shared required PWA install assets and icon. |
| Browser workflows | Desktop/mobile production tests traverse document → retrieval → context → unavailable-provider feedback and verify empty results for unrelated queries. |

Run on Node 22: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm audit --audit-level=low`, `npm run build`, `npx playwright install chromium`, `npm run test:e2e`. `E2E_DEV=1` runs development mode. Credentials are server-only environment variables; no key is needed for the default tests.

Provider tests use an injected transport and test-only placeholder, not paid xAI inference. The NVIDIA key from separate NIM projects is not an xAI credential. No live xAI call was made in this follow-up. Live adversarial prompt/citation evaluation needs an authorized xAI account; system prompting and citation-ID checks do not prove semantic correctness or prompt-injection immunity.

The hourly ceiling is process-local and resets on restart. Before a public multi-instance paid deployment, enforce authentication and a shared provider spending/rate budget at the gateway. This PR retains a local educational demo with TF-IDF/BM25 and a visual hash projection; it is not a neural embedding quality benchmark. Clinical, legal or other high-stakes use needs separate corpus and answer-quality evaluation. No production deployment is changed here.
