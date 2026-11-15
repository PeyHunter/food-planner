ALTER TABLE "recipes" ADD COLUMN "minutes" integer;--> statement-breakpoint
UPDATE "recipe_lines" SET "amount" = "amount" * 5, "unit" = 'ml' WHERE "unit" = 'tsp';--> statement-breakpoint
UPDATE "recipe_lines" SET "amount" = "amount" * 15, "unit" = 'ml' WHERE "unit" = 'tbsp';--> statement-breakpoint
UPDATE "ingredients" SET "pack_amount" = "pack_amount" * 5, "pack_unit" = 'ml' WHERE "pack_unit" = 'tsp';--> statement-breakpoint
UPDATE "ingredients" SET "pack_amount" = "pack_amount" * 15, "pack_unit" = 'ml' WHERE "pack_unit" = 'tbsp';
