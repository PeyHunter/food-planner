ALTER TABLE "kitchens" ALTER COLUMN "nemlig_organic" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "kitchens" ALTER COLUMN "nemlig_organic" SET DATA TYPE text USING (CASE WHEN "nemlig_organic" THEN 'all' ELSE 'none' END);--> statement-breakpoint
ALTER TABLE "kitchens" ALTER COLUMN "nemlig_organic" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "nemlig_word" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "nemlig_link" text;
