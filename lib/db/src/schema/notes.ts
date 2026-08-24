import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const notesTable = pgTable("pa_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  topic: text("topic").notNull().default("General"),
  folder: text("folder").notNull().default("Notes"),
  reminderDate: text("reminder_date"),
  reminder: boolean("reminder").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PANote = typeof notesTable.$inferSelect;