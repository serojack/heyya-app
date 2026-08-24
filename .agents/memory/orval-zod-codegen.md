---
name: Orval v8 + Zod v3 codegen quirks
description: Two recurring codegen issues with Orval v8.23 + Zod 3.25 workspace setup and their fixes.
---

## Rule 1: Use `type: number` not `type: integer` in OpenAPI spec

Orval v8.23 generates `zod.int()` for `type: integer`. `zod.int()` is a Zod v4 method — it does NOT exist on the `zod` import in Zod v3 (`zod@3.25.x`).

**Fix:** Use `type: number` (and `type: ["number", "null"]` for nullable) throughout `lib/api-spec/openapi.yaml`.

**Why:** The workspace catalog pins `zod: ^3.25.76`. The `/v4` subpath exists on 3.25 for compat but `import * as zod from 'zod'` still uses v3 API.

## Rule 2: Barrel collision — `ListFooParams` in both generated/api.ts and generated/types/

In Orval split+zod mode, the generated barrel `lib/api-zod/src/index.ts` re-exports from both `./generated/api` AND `./generated/types`. Operations with query params produce a `<OperationId>Params` TypeScript type in both places → TS2308 collision.

**Fix:** The codegen script in `lib/api-spec/package.json` includes a `sed` post-processor that strips the `generated/types` export line from the barrel after each Orval run:
```json
"codegen": "orval --config ./orval.config.ts && sed -i \"/generated\\/types/d\" ../../lib/api-zod/src/index.ts && pnpm -w run typecheck:libs"
```

Also set `orval.config.ts` zod output to NOT include `schemas: { path: "generated/types", type: "typescript" }`.

**Why:** Orval always regenerates `src/index.ts` with both exports. The sed step is idempotent and runs before typecheck.

## Rule 4: React Query option types must omit the generated query key

Orval's React Query output can type caller-supplied `query` options with a required `queryKey`, even though each generated hook supplies its own key. Keep the caller type key-optional while retaining the generated hook result key.

**Fix:** The api-spec codegen command post-processes React output with a local `QueryOptions` alias based on `Omit<UseQueryOptions<...>, "queryKey">` plus an optional `queryKey`.

**Why:** Heyya callers commonly provide only behavioral options such as `enabled`, `retry`, or `refetchInterval`; requiring an internal cache key breaks the frontend typecheck.

## Rule 3: Date-format Zod fields are `Date` objects

With `useDates: true` in orval config, `format: date` fields in responses/bodies become `zod.coerce.date()` → TypeScript type is `Date`. But Drizzle `date(col, { mode: "string" })` columns expect a `string`.

**Fix:** Convert before inserting:
```ts
const dateStr = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
```
