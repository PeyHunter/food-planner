CREATE TABLE "child_freezer_portions" (
	"child_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_freezer_portions_child_id_recipe_id_pk" PRIMARY KEY("child_id","recipe_id"),
	CONSTRAINT "child_freezer_portions_count" CHECK ("child_freezer_portions"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "child_days" ADD COLUMN "from_freezer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "child_freezer_portions" ADD CONSTRAINT "child_freezer_portions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_freezer_portions" ADD CONSTRAINT "child_freezer_portions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_freezer_portions" ADD CONSTRAINT "child_freezer_portions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;