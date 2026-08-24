import { pgTable, serial, timestamp, integer, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";
import { messagesTable } from "./messages";

export const attendanceRecordsTable = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id")
    .notNull()
    .references(() => roomsTable.id, { onDelete: "cascade" }),
  messageId: integer("message_id").references(() => messagesTable.id, { onDelete: "set null" }),
  date: date("date", { mode: "string" }).notNull(),
  finalized: boolean("finalized").notNull().default(false),
  // entries stored as JSON array: [{studentId, status}]
  entries: jsonb("entries").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceRecordsTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
