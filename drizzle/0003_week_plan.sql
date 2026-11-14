CREATE TABLE "child_days" (
	"child_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"recipe_id" uuid,
	CONSTRAINT "child_days_child_id_date_pk" PRIMARY KEY("child_id","date")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kitchen_id" uuid NOT NULL,
	"name" text NOT NULL,
	"birthday" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_days" (
	"kitchen_id" uuid NOT NULL,
	"date" date NOT NULL,
	"people" integer DEFAULT 2 NOT NULL,
	"dinner_recipe_id" uuid,
	CONSTRAINT "plan_days_kitchen_id_date_pk" PRIMARY KEY("kitchen_id","date"),
	CONSTRAINT "plan_days_people" CHECK ("plan_days"."people" between 1 and 50)
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kitchen_id" uuid NOT NULL,
	"child_id" uuid,
	"op" text NOT NULL,
	"n" integer NOT NULL,
	"what" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_days" ADD CONSTRAINT "child_days_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_days" ADD CONSTRAINT "child_days_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_days" ADD CONSTRAINT "plan_days_dinner_recipe_id_recipes_id_fk" FOREIGN KEY ("dinner_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "children_kitchen" ON "children" USING btree ("kitchen_id");--> statement-breakpoint
CREATE INDEX "rules_kitchen" ON "rules" USING btree ("kitchen_id");