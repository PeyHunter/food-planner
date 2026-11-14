import { sql } from "drizzle-orm";
import { boolean, check, date, doublePrecision, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const at = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: at("created_at").notNull().defaultNow(),
});

export const kitchens = pgTable("kitchens", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
});

export const kitchenMembers = pgTable(
  "kitchen_members",
  {
    kitchenId: uuid("kitchen_id")
      .notNull()
      .references(() => kitchens.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.kitchenId, table.userId] })],
);

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: at("created_at").notNull(),
  expiresAt: at("expires_at").notNull(),
});

const kitchenId = () =>
  uuid("kitchen_id")
    .notNull()
    .references(() => kitchens.id, { onDelete: "cascade" });
const createdBy = () => uuid("created_by").references(() => users.id, { onDelete: "set null" });
const recipeId = () =>
  uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" });

export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitchenId: kitchenId(),
    name: text("name").notNull(),
    shopSection: text("shop_section").notNull().default("Other"),
    packAmount: doublePrecision("pack_amount"),
    packUnit: text("pack_unit"),
    alwaysAtHome: boolean("always_at_home").notNull().default(false),
    createdBy: createdBy(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  // "Carrot" and "carrot" are the same ingredient.
  (table) => [uniqueIndex("ingredients_kitchen_name_unique").on(table.kitchenId, sql`lower(${table.name})`)],
);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitchenId: kitchenId(),
    title: text("title").notNull(),
    feeds: integer("feeds").notNull(),
    ageFromMonths: integer("age_from_months"),
    ageToMonths: integer("age_to_months"),
    createdBy: createdBy(),
    createdAt: at("created_at").notNull().defaultNow(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (table) => [index("recipes_kitchen").on(table.kitchenId), check("recipes_feeds_positive", sql`${table.feeds} > 0`)],
);

export const recipeTypes = pgTable("recipe_types", { recipeId: recipeId(), type: text("type").notNull() }, (table) => [
  primaryKey({ columns: [table.recipeId, table.type] }),
]);

export const recipeTags = pgTable("recipe_tags", { recipeId: recipeId(), tag: text("tag").notNull() }, (table) => [
  primaryKey({ columns: [table.recipeId, table.tag] }),
]);

export const recipeLines = pgTable(
  "recipe_lines",
  {
    recipeId: recipeId(),
    position: integer("position").notNull(),
    amount: doublePrecision("amount"),
    unit: text("unit"),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "restrict" }),
    note: text("note").notNull().default(""),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.position] })],
);

export const steps = pgTable(
  "steps",
  { recipeId: recipeId(), position: integer("position").notNull(), text: text("text").notNull() },
  (table) => [primaryKey({ columns: [table.recipeId, table.position] })],
);

export const cooks = pgTable("cooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipeId: recipeId(),
  madeOn: date("made_on", { mode: "string" }).notNull(),
  createdBy: createdBy(),
  createdAt: at("created_at").notNull().defaultNow(),
});

/** The file is <id>.jpg in PHOTOS_DIR. A recipe has at most one main photo; the rest are its gallery. */
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: recipeId(),
    cookId: uuid("cook_id").references(() => cooks.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    createdBy: createdBy(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("photos_recipe").on(table.recipeId),
    uniqueIndex("photos_one_main").on(table.recipeId).where(sql`${table.role} = 'main'`),
  ],
);
