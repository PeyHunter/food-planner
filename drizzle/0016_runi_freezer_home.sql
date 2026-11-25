-- Child recipes (tag "for Runi" or an age range) belong in the child's own freezer, not the kitchen's.
-- In a kitchen with exactly one child, their kitchen portions move to that child, adding to what she has.
INSERT INTO "child_freezer_portions" ("child_id", "recipe_id", "count", "updated_by", "updated_at")
SELECT k."id", fp."recipe_id", fp."count", fp."updated_by", now()
FROM "freezer_portions" fp
JOIN "recipes" r ON r."id" = fp."recipe_id"
JOIN "children" k ON k."kitchen_id" = fp."kitchen_id"
WHERE fp."count" > 0
  AND (r."age_from_months" IS NOT NULL OR r."age_to_months" IS NOT NULL OR EXISTS (SELECT 1 FROM "recipe_tags" t WHERE t."recipe_id" = r."id" AND t."tag" = 'for Runi'))
  AND (SELECT count(*) FROM "children" c WHERE c."kitchen_id" = fp."kitchen_id") = 1
ON CONFLICT ("child_id", "recipe_id") DO UPDATE SET "count" = "child_freezer_portions"."count" + EXCLUDED."count", "updated_at" = now();--> statement-breakpoint
DELETE FROM "freezer_portions" fp
USING "recipes" r
WHERE r."id" = fp."recipe_id"
  AND (r."age_from_months" IS NOT NULL OR r."age_to_months" IS NOT NULL OR EXISTS (SELECT 1 FROM "recipe_tags" t WHERE t."recipe_id" = r."id" AND t."tag" = 'for Runi'))
  AND (SELECT count(*) FROM "children" c WHERE c."kitchen_id" = fp."kitchen_id") = 1;--> statement-breakpoint
UPDATE "users" SET "display_name" = 'Anna A' WHERE "username" = 'annaa' AND "display_name" = 'Anna D';--> statement-breakpoint
UPDATE "kitchens" SET "name" = 'Anna A and Jacob''s kitchen' WHERE "name" = 'Anna D and Jacob''s kitchen';
