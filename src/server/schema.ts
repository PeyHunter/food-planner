import { sql } from "drizzle-orm";
import { boolean, check, date, doublePrecision, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const at = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** "en" or "da". */
  language: text("language").notNull().default("en"),
  createdAt: at("created_at").notNull().defaultNow(),
});

export const kitchens = pgTable("kitchens", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** False for a kitchen without children: no Runi & kids tab, no child rules or meals. */
  kids: boolean("kids").notNull().default(true),
  /** Getting ready for nemlig.com home delivery. Nothing is sent to nemlig yet. */
  nemligOn: boolean("nemlig_on").notNull().default(false),
  /** 0 is Monday, 6 is Sunday. */
  nemligDay: integer("nemlig_day").notNull().default(6),
  nemligOrganic: boolean("nemlig_organic").notNull().default(false),
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
    /** Grams in one piece ("1 onion" is about 150 g), so counted lines can fill packs sold by weight and back. */
    pieceGrams: doublePrecision("piece_grams"),
    /** Who set the pack size: "catalog:<version>" from the shop catalog, "user" once a person edits it, null before either. */
    packSource: text("pack_source"),
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
    description: text("description").notNull().default(""),
    feeds: integer("feeds").notNull(),
    /** Total cooking time in minutes, or null when unknown. */
    minutes: integer("minutes"),
    ageFromMonths: integer("age_from_months"),
    ageToMonths: integer("age_to_months"),
    /** Null while the recipe isn't shared. Turning sharing off clears it, so an old link never works again. */
    shareToken: text("share_token").unique(),
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

export const children = pgTable(
  "children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitchenId: kitchenId(),
    name: text("name").notNull(),
    birthday: date("birthday", { mode: "string" }),
    /** A day with no meal planned for the child reads as "Same as dinner". */
    sameAsDinnerByDefault: boolean("same_as_dinner_by_default").notNull().default(false),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (table) => [index("children_kitchen").on(table.kitchenId)],
);

/** A day with no row is empty with the default people count. */
export const planDays = pgTable(
  "plan_days",
  {
    kitchenId: kitchenId(),
    date: date("date", { mode: "string" }).notNull(),
    people: integer("people").notNull().default(2),
    dinnerRecipeId: uuid("dinner_recipe_id").references(() => recipes.id, { onDelete: "set null" }),
    /** The dinner is a portion taken from the freezer: it adds nothing to the shopping list. */
    fromFreezer: boolean("from_freezer").notNull().default(false),
    /** A dinner with no recipe and nothing to buy: out, takeout or other. Null for a normal dinner. */
    awayKind: text("away_kind"),
    /** Free words for the away dinner, like "At Isabel's". */
    awayNote: text("away_note").notNull().default(""),
  },
  (table) => [primaryKey({ columns: [table.kitchenId, table.date] }), check("plan_days_people", sql`${table.people} between 1 and 50`)],
);

/** More dishes for the same dinner, like a salad next to the main dish. */
export const planSides = pgTable(
  "plan_sides",
  {
    kitchenId: kitchenId(),
    date: date("date", { mode: "string" }).notNull(),
    position: integer("position").notNull(),
    recipeId: recipeId(),
  },
  (table) => [primaryKey({ columns: [table.kitchenId, table.date, table.position] })],
);

/** kind is empty, same-as-dinner or recipe. A recipe row whose recipe was deleted reads as empty. */
export const childDays = pgTable(
  "child_days",
  {
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    kind: text("kind").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  },
  (table) => [primaryKey({ columns: [table.childId, table.date] })],
);

/** childId null is the adults' rule. op is at-least or at-most; what is a main type or a tag. */
export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitchenId: kitchenId(),
    childId: uuid("child_id").references(() => children.id, { onDelete: "cascade" }),
    op: text("op").notNull(),
    n: integer("n").notNull(),
    what: text("what").notNull(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (table) => [index("rules_kitchen").on(table.kitchenId)],
);

/** A ticked item on a week's shopping list. item_key is a list line's key or "extra:<id>". Cleared ticks are hidden. */
export const shoppingTicks = pgTable(
  "shopping_ticks",
  {
    kitchenId: kitchenId(),
    monday: date("monday", { mode: "string" }).notNull(),
    itemKey: text("item_key").notNull(),
    cleared: boolean("cleared").notNull().default(false),
    tickedBy: uuid("ticked_by").references(() => users.id, { onDelete: "set null" }),
    tickedAt: at("ticked_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.kitchenId, table.monday, table.itemKey] })],
);

/** Things to buy that no planned dinner needs, like milk. */
export const shoppingExtras = pgTable(
  "shopping_extras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitchenId: kitchenId(),
    monday: date("monday", { mode: "string" }).notNull(),
    name: text("name").notNull(),
    createdBy: createdBy(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (table) => [index("shopping_extras_week").on(table.kitchenId, table.monday)],
);

/** Portions of a dish in the freezer. Planning a night "from the freezer" takes one out. */
export const freezerPortions = pgTable(
  "freezer_portions",
  {
    kitchenId: kitchenId(),
    recipeId: recipeId(),
    count: integer("count").notNull().default(0),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.kitchenId, table.recipeId] }), check("freezer_portions_count", sql`${table.count} >= 0`)],
);
