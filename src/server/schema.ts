import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
