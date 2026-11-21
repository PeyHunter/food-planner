CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kitchen_id" uuid NOT NULL,
	"user_id" uuid,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"cost_usd" numeric(12, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "starter_added_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_calls" ADD CONSTRAINT "ai_calls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_calls_created" ON "ai_calls" USING btree ("created_at");--> statement-breakpoint
-- Kitchens made before starter recipes existed are not given them on the next start.
UPDATE "kitchens" SET "starter_added_at" = now();