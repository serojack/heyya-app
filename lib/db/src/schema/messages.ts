import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { roomsTable } from "./rooms";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => roomsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").references(() => usersTable.id, { onDelete: "set null" }),
  type: text("type", {
    enum: [
      "text",
      "system",
      "attendance_card",
      "leave_card",
      "ai_message",
      "file",
      "confirmation_card",
      "hook_card",
    ],
  })
    .notNull()
    .default("text"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  reactions: jsonb("reactions").default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
