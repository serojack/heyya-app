import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: text("date").notNull(),          // YYYY-MM-DD
  time: text("time"),                    // HH:MM (optional)
  location: text("location"),
  notes: text("notes"),
  isReminder: boolean("is_reminder").notNull().default(false),
  inviteStatus: text("invite_status", { enum: ["not_sent", "sent"] }).notNull().default("not_sent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = typeof appointmentsTable.$inferInsert;
