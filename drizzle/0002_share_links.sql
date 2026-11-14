ALTER TABLE "recipes" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_share_token_unique" UNIQUE("share_token");