import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, doublePrecision, index, integer, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
  /** Sends the shopping list to nemlig.com: the app opens nemlig's pages, the user fills the basket there. */
  nemligOn: boolean("nemlig_on").notNull().default(false),
  /** 0 is Monday, 6 is Sunday. */
  nemligDay: integer("nemlig_day").notNull().default(6),
  /** "none", "produce" (fruit and veg) or "all". */
  nemligOrganic: text("nemlig_organic").notNull().default("none"),
  /** When the starter recipes were put in at creation. Kitchens made before they existed count as done. */
  starterAddedAt: at("starter_added_at"),
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
  /** Shown on Profile > Devices; the token hash never leaves the server. */
  id: uuid("id").notNull().unique().defaultRandom(),
  createdAt: at("created_at").notNull(),
  expiresAt: at("expires_at").notNull(),
  /** Updated at most once an hour, so a request doesn't write. */
  lastUsedAt: at("last_used_at").notNull().defaultNow(),
  userAgent: text("user_agent").notNull().default(""),
  /** When this device last proved who it is (login or "Confirm it's you"), and how: "password" or "passkey". */
  authenticatedAt: at("authenticated_at").notNull().defaultNow(),
  authMethod: text("auth_method").notNull().default("password"),
});

/** WebAuthn credentials (Face ID, fingerprint, security keys). */
export const passkeys = pgTable(
  "passkeys",
  {
    /** The credential ID, base64url. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** COSE public key, base64url. */
    publicKey: text("public_key").notNull(),
    counter: bigint("counter", { mode: "number" }).notNull().default(0),
    transports: text("transports").array().notNull().default(sql`'{}'::text[]`),
    /** Where it was added, e.g. "Safari on iPhone". */
    name: text("name").notNull(),
    createdAt: at("created_at").notNull(),
    lastUsedAt: at("last_used_at"),
  },
  (table) => [index("passkeys_user").on(table.userId)],
);

/** One row per failed login; `key` is "name:<username>" or "ip:<address>". Old rows are cleared as new ones come. */
export const loginFailures = pgTable(
  "login_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    failedAt: at("failed_at").notNull(),
  },
  (table) => [index("login_failures_key_time").on(table.key, table.failedAt)],
);

/** Per-person secrets such as a nemlig.com login, sealed with AES-256-GCM (src/server/secrets.ts). Binary parts are base64. */
export const secrets = pgTable(
  "secrets",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    tag: text("tag").notNull(),
    createdAt: at("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.kind] })],
);

/** What happened to a login: passkeys added, devices logged out, nemlig.com actions. Shown on Profile > Activity. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    detail: text("detail").notNull().default(""),
    at: at("at").notNull(),
  },
  (table) => [index("audit_log_user_at").on(table.userId, table.at)],
);

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
    /** The nemlig.com search word or product link the kitchen picked for this ingredient, kept for next week. */
    nemligWord: text("nemlig_word"),
    nemligLink: text("nemlig_link"),
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

/** One row per Claude API call, for the usage report (scripts/usage-report.sql). */
export const aiCalls = pgTable(
  "ai_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kitchenId: kitchenId(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** photo, link or vegetarian. */
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull(),
    createdAt: at("created_at").notNull().defaultNow(),
  },
  (table) => [index("ai_calls_created").on(table.createdAt)],
);
