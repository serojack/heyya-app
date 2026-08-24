import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, attendanceRecordsTable, messagesTable, roomMembersTable, usersTable } from "@workspace/db";
import {
  ListAttendanceParams,
  ListAttendanceResponse,
  CreateAttendanceParams,
  CreateAttendanceBody,
  CreateAttendanceResponse,
  GetAttendanceParams,
  GetAttendanceResponse,
  UpdateAttendanceEntryParams,
  UpdateAttendanceEntryBody,
  UpdateAttendanceEntryResponse,
  FinalizeAttendanceParams,
  FinalizeAttendanceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getCurrentUserId(req: any): number | null {
  const val = req.signedCookies?.userId || req.cookies?.userId;
  const id = parseInt(val, 10);
  return isNaN(id) ? null : id;
}

type AttendanceEntry = { studentId: number; status: string };

async function enrichAttendance(record: any) {
  const entries = (record.entries as AttendanceEntry[]) || [];
  // Fetch student details for each entry
  const enrichedEntries = await Promise.all(
    entries.map(async (entry) => {
      const [student] = await db.select().from(usersTable).where(eq(usersTable.id, entry.studentId));
      return { ...entry, student: student ?? null };
    })
  );
  const presentCount = entries.filter((e) => e.status === "present").length;
  const absentCount = entries.filter((e) => e.status === "absent").length;
  const lateCount = entries.filter((e) => e.status === "late").length;
  const excusedCount = entries.filter((e) => e.status === "excused").length;

  return {
    ...record,
    entries: enrichedEntries,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
  };
}

router.get("/rooms/:roomId/attendance", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const params = ListAttendanceParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const records = await db
    .select()
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.roomId, params.data.roomId))
    .orderBy(attendanceRecordsTable.date);

  const enriched = await Promise.all(records.map(enrichAttendance));
  res.json(ListAttendanceResponse.parse(enriched));
});

router.post("/rooms/:roomId/attendance", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const pathParams = CreateAttendanceParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }
  const parsed = CreateAttendanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const roomId = pathParams.data.roomId;
  const rawDate = parsed.data.date;
  const date = rawDate
    ? rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : String(rawDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Get all students in this room
  const members = await db
    .select({ userId: roomMembersTable.userId, role: usersTable.role })
    .from(roomMembersTable)
    .innerJoin(usersTable, eq(roomMembersTable.userId, usersTable.id))
    .where(eq(roomMembersTable.roomId, roomId));

  const students = members.filter((m) => m.role === "student");
  const entries: AttendanceEntry[] = students.map((s) => ({
    studentId: s.userId,
    status: "present",
  }));

  const [record] = await db
    .insert(attendanceRecordsTable)
    .values({
      roomId,
      date,
      finalized: false,
      entries,
    })
    .returning();

  // Post an attendance_card message in the room
  const [msg] = await db
    .insert(messagesTable)
    .values({
      roomId,
      senderId: userId ?? undefined,
      type: "attendance_card",
      content: `Attendance opened for ${date}`,
      metadata: { attendanceId: record.id, date },
      reactions: [],
    })
    .returning();

  // Link the message to the attendance record
  await db
    .update(attendanceRecordsTable)
    .set({ messageId: msg.id })
    .where(eq(attendanceRecordsTable.id, record.id));

  const updated = await db.select().from(attendanceRecordsTable).where(eq(attendanceRecordsTable.id, record.id));
  const enriched = await enrichAttendance(updated[0]);
  res.status(201).json(CreateAttendanceResponse.parse(enriched));
});

router.get("/attendance/:attendanceId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.attendanceId)
    ? req.params.attendanceId[0]
    : req.params.attendanceId;
  const params = GetAttendanceParams.safeParse({ attendanceId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [record] = await db
    .select()
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.id, params.data.attendanceId));
  if (!record) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }
  const enriched = await enrichAttendance(record);
  res.json(GetAttendanceResponse.parse(enriched));
});

router.patch("/attendance/:attendanceId/entries", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.attendanceId)
    ? req.params.attendanceId[0]
    : req.params.attendanceId;
  const params = UpdateAttendanceEntryParams.safeParse({ attendanceId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAttendanceEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [record] = await db
    .select()
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.id, params.data.attendanceId));
  if (!record) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }
  if (record.finalized) {
    res.status(400).json({ error: "Attendance already finalized" });
    return;
  }

  const entries = (record.entries as AttendanceEntry[]) || [];
  const idx = entries.findIndex((e) => e.studentId === parsed.data.studentId);
  if (idx >= 0) {
    entries[idx].status = parsed.data.status;
  } else {
    entries.push({ studentId: parsed.data.studentId, status: parsed.data.status });
  }

  await db
    .update(attendanceRecordsTable)
    .set({ entries })
    .where(eq(attendanceRecordsTable.id, params.data.attendanceId));

  const updated = await db.select().from(attendanceRecordsTable).where(eq(attendanceRecordsTable.id, params.data.attendanceId));
  const enriched = await enrichAttendance(updated[0]);
  res.json(UpdateAttendanceEntryResponse.parse(enriched));
});

router.post("/attendance/:attendanceId/finalize", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.attendanceId)
    ? req.params.attendanceId[0]
    : req.params.attendanceId;
  const params = FinalizeAttendanceParams.safeParse({ attendanceId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [record] = await db
    .select()
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.id, params.data.attendanceId));
  if (!record) {
    res.status(404).json({ error: "Attendance record not found" });
    return;
  }

  const entries = (record.entries as AttendanceEntry[]) || [];
  const presentCount = entries.filter((e) => e.status === "present").length;
  const absentCount = entries.filter((e) => e.status === "absent").length;
  const lateCount = entries.filter((e) => e.status === "late").length;
  const excusedCount = entries.filter((e) => e.status === "excused").length;

  await db
    .update(attendanceRecordsTable)
    .set({ finalized: true })
    .where(eq(attendanceRecordsTable.id, params.data.attendanceId));

  // Update the attendance_card message with final summary
  if (record.messageId) {
    await db
      .update(messagesTable)
      .set({
        content: `Attendance finalized: ${presentCount} Present · ${absentCount} Absent · ${lateCount} Late · ${excusedCount} Excused`,
        metadata: {
          attendanceId: record.id,
          date: record.date,
          finalized: true,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
        },
      })
      .where(eq(messagesTable.id, record.messageId));
  }

  const updated = await db.select().from(attendanceRecordsTable).where(eq(attendanceRecordsTable.id, params.data.attendanceId));
  const enriched = await enrichAttendance(updated[0]);
  res.json(FinalizeAttendanceResponse.parse(enriched));
});

export default router;
