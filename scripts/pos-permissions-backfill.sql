-- Backfill ciblé : ajoute pos.sell/pos.read/pos.manage aux rôles Admin
-- dont le tableau permissions est figé depuis avant le module POS.
-- Idempotent : n'ajoute que les entrées manquantes.
UPDATE "Role"
SET permissions = (
  SELECT jsonb_agg(DISTINCT p)
  FROM jsonb_array_elements(permissions || '["pos.sell","pos.read","pos.manage"]'::jsonb) AS p
)
WHERE name = 'Admin'
  AND NOT (permissions @> '["pos.sell","pos.read","pos.manage"]'::jsonb);
