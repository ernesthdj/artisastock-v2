-- Backfill de la permission settings.flush_data sur les rôles Admin existants.
-- Même contournement que scripts/flow-permission-backfill.sql : le seed/register écrit la
-- permission pour tout NOUVEAU tenant (source de vérité src/lib/constants/permissions.ts),
-- mais les rôles Admin déjà créés en prod ne l'ont pas — et withPermission() bypass isSystem
-- côté serveur masque le problème, alors que le gate client can() lit le tableau permissions.
-- Exécuter via `supabase link --project-ref <ref>` puis `supabase db query --linked`.
-- Idempotent (NOT permissions @> ... évite les doublons).

UPDATE "Role"
SET permissions = permissions || '["settings.flush_data"]'::jsonb
WHERE name = 'Admin'
  AND NOT permissions @> '["settings.flush_data"]'::jsonb
RETURNING id, "tenantId";
