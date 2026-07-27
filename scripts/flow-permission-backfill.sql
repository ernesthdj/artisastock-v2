-- Backfill de la permission flow.read sur les rôles Admin existants.
-- scripts/backfill-flow-permission.ts (Prisma) ne peut pas tourner contre Supabase prod dans ce
-- sandbox (DATABASE_URL/DIRECT_URL scrubées automatiquement — règle #32 du JOURNAL). Contournement :
-- exécuter ce SQL via `supabase link --project-ref <ref>` puis `supabase db query --linked`.
-- Idempotent (NOT permissions @> ... évite les doublons).

UPDATE "Role"
SET permissions = permissions || '["flow.read"]'::jsonb
WHERE name = 'Admin'
  AND NOT permissions @> '["flow.read"]'::jsonb
RETURNING id, "tenantId";
