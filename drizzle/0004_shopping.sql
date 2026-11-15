CREATE TABLE "shopping_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kitchen_id" uuid NOT NULL,
	"monday" date NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_ticks" (
	"kitchen_id" uuid NOT NULL,
	"monday" date NOT NULL,
	"item_key" text NOT NULL,
	"cleared" boolean DEFAULT false NOT NULL,
	"ticked_by" uuid,
	"ticked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_ticks_kitchen_id_monday_item_key_pk" PRIMARY KEY("kitchen_id","monday","item_key")
);
--> statement-breakpoint
ALTER TABLE "shopping_extras" ADD CONSTRAINT "shopping_extras_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_extras" ADD CONSTRAINT "shopping_extras_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_ticks" ADD CONSTRAINT "shopping_ticks_kitchen_id_kitchens_id_fk" FOREIGN KEY ("kitchen_id") REFERENCES "public"."kitchens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_ticks" ADD CONSTRAINT "shopping_ticks_ticked_by_users_id_fk" FOREIGN KEY ("ticked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_extras_week" ON "shopping_extras" USING btree ("kitchen_id","monday");