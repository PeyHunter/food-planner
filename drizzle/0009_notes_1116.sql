CREATE TABLE "plan_sides" (
	"kitchen_id" uuid NOT NULL,
	"date" date NOT NULL,
	"position" integer NOT NULL,
	"recipe_id" uuid NOT NULL,
	CONSTRAINT "plan_sides_kitchen_id_date_position_pk" PRIMARY KEY("kitchen_id","date","position")
);
--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "same_as_dinner_by_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "nemlig_on" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "nemlig_day" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "kitchens" ADD COLUMN "nemlig_organic" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "away_kind" text;--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "away_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "plan_sides" ADD CONSTRAINT "plan_sides_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_sides" ADD CONSTRAINT "plan_sides_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;