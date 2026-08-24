import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const savedLinksTable = pgTable("saved_links", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  category: text("category"),            // AI-detected: e.g. "resource", "news", "tool"
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SavedLink = typeof savedLinksTable.$inferSelect;
export type InsertSavedLink = typeof savedLinksTable.$inferInsert;
