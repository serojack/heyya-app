import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["admin", "teacher", "student", "parent"] }).notNull(),
  avatarUrl: text("avatar_url"),
  status: text("status", { enum: ["online", "offline", "on_leave", "withdrawn"] }).notNull().default("offline"),
  schoolId: text("school_id"),       // e.g. GPH2022642801
  preferredName: text("preferred_name"), // e.g. "Fred"
  childId: integer("child_id"), // parent's linked student
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
