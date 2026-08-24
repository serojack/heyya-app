import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "./users";
import {
  parseIntent,
  executeAction,
  getUserAppointments,
  getUserFiles,
  getUserLinks,
  getUserNotes,
  getUserTasks,
} from "../lib/pa-assistant";
import { privateStorage } from "../lib/private-storage";
import { db, appointmentsTable, filesTable, leaveRequestsTable, notesTable, savedLinksTable, tasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// ── POST /pa/chat ────────────────────────────────────────────────────────────

const ChatInputSchema = z.object({
  message: z.string().min(1),
});

router.post("/pa/chat", requireAuth, async (req, res) => {
  const body = ChatInputSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const userId = res.locals.userId as number;
  const result = await parseIntent(body.data.message, userId);
  res.json(result);
});

// ── POST /pa/execute ─────────────────────────────────────────────────────────

const ExecuteInputSchema = z.object({
  type: z.enum(["leave", "appointment", "task", "note", "link", "file_note", "notify", "chat", "unclear"]),
  details: z.record(z.string(), z.unknown()),
});

router.post("/pa/execute", requireAuth, async (req, res) => {
  const body = ExecuteInputSchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const userId = res.locals.userId as number;
  const result = await executeAction(body.data.type as any, body.data.details as any, userId);
  res.json(result);
});

// ── GET /pa/appointments ─────────────────────────────────────────────────────

router.get("/pa/appointments", requireAuth, async (req, res) => {
  const userId = res.locals.userId as number;
  const appointments = await getUserAppointments(userId);
  res.json(appointments);
});

// ── DELETE /pa/appointments/:id ──────────────────────────────────────────────

router.delete("/pa/appointments/:id", requireAuth, async (req, res) => {
  const userId = res.locals.userId as number;
  const aptId = Number(req.params.id);
  if (isNaN(aptId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(appointmentsTable)
    .where(and(eq(appointmentsTable.id, aptId), eq(appointmentsTable.userId, userId)));
  res.status(204).end();
});

router.patch("/pa/appointments/:id/invite", requireAuth, async (req, res) => {
  const userId = res.locals.userId as number;
  const appointmentId = Number(req.params.id);
  if (Number.isNaN(appointmentId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [appointment] = await db.update(appointmentsTable)
    .set({ inviteStatus: "sent" })
    .where(and(eq(appointmentsTable.id, appointmentId), eq(appointmentsTable.userId, userId)))
    .returning();
  if (!appointment) { res.status(404).json({ error: "Appointment not found" }); return; }
  res.json(appointment);
});

// ── GET /pa/links ────────────────────────────────────────────────────────────

router.get("/pa/links", requireAuth, async (req, res) => {
  const userId = res.locals.userId as number;
  const links = await getUserLinks(userId);
  res.json(links);
});

// ── DELETE /pa/links/:id ─────────────────────────────────────────────────────

router.delete("/pa/links/:id", requireAuth, async (req, res) => {
  const userId = res.locals.userId as number;
  const linkId = Number(req.params.id);
  if (isNaN(linkId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.delete(savedLinksTable)
    .where(and(eq(savedLinksTable.id, linkId), eq(savedLinksTable.userId, userId)));
  res.status(204).end();
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

router.get("/pa/tasks", requireAuth, async (_req, res) => {
  res.json(await getUserTasks(res.locals.userId as number));
});

router.patch("/pa/tasks/:id", requireAuth, async (req, res) => {
  const userId = res.locals.userId as number;
  const taskId = Number(req.params.id);
  const body = z.object({ completed: z.boolean() }).safeParse(req.body);
  if (Number.isNaN(taskId) || !body.success) { res.status(400).json({ error: "Invalid task update" }); return; }
  const [task] = await db.update(tasksTable).set({
    completed: body.data.completed,
    completedAt: body.data.completed ? new Date() : null,
  }).where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, userId))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(task);
});

router.delete("/pa/tasks/:id", requireAuth, async (req, res) => {
  const taskId = Number(req.params.id);
  if (Number.isNaN(taskId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(tasksTable).where(and(eq(tasksTable.id, taskId), eq(tasksTable.userId, res.locals.userId as number)));
  res.status(204).end();
});

// ── Notes ─────────────────────────────────────────────────────────────────────

router.get("/pa/notes", requireAuth, async (_req, res) => {
  res.json(await getUserNotes(res.locals.userId as number));
});

router.delete("/pa/notes/:id", requireAuth, async (req, res) => {
  const noteId = Number(req.params.id);
  if (Number.isNaN(noteId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(notesTable).where(and(eq(notesTable.id, noteId), eq(notesTable.userId, res.locals.userId as number)));
  res.status(204).end();
});

// ── Private files ─────────────────────────────────────────────────────────────

const UploadRequestSchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(100 * 1024 * 1024),
  contentType: z.string().min(1),
  folder: z.string().min(1).max(120).default("Uploads"),
});

const allowedContentTypes = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4", "video/webm", "video/quicktime",
]);

function resolveFileType(contentType: string): "image" | "video" | "document" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

router.post("/pa/uploads/request", requireAuth, async (req, res) => {
  const body = UploadRequestSchema.safeParse(req.body);
  if (!body.success || !allowedContentTypes.has(body.data.contentType)) {
    res.status(400).json({ error: "Use an image, Word document, PDF, or common video format (up to 100 MB)." });
    return;
  }
  try {
    const signed = await privateStorage.createUpload();
    res.json({ ...signed, fileType: resolveFileType(body.data.contentType) });
  } catch (error) {
    req.log.error({ err: error }, "private upload URL creation failed");
    res.status(500).json({ error: "Unable to prepare secure upload" });
  }
});

const FileRecordSchema = z.object({
  objectPath: z.string().regex(/^\/objects\/uploads\//),
  originalName: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().int().positive().max(100 * 1024 * 1024),
  folder: z.string().min(1).max(120).default("Uploads"),
  relatedType: z.string().max(50).optional(),
  relatedId: z.number().int().positive().optional(),
});

router.post("/pa/files", requireAuth, async (req, res) => {
  const body = FileRecordSchema.safeParse(req.body);
  if (!body.success || !allowedContentTypes.has(body.data.mimeType)) { res.status(400).json({ error: "Invalid file metadata" }); return; }
  const [file] = await db.insert(filesTable).values({
    userId: res.locals.userId as number,
    objectPath: body.data.objectPath,
    originalName: body.data.originalName,
    mimeType: body.data.mimeType,
    size: body.data.size,
    folder: body.data.folder,
    fileType: resolveFileType(body.data.mimeType),
    relatedType: body.data.relatedType ?? null,
    relatedId: body.data.relatedId ?? null,
  }).returning();
  res.status(201).json(file);
});

router.get("/pa/files", requireAuth, async (_req, res) => {
  res.json(await getUserFiles(res.locals.userId as number));
});

router.get("/pa/files/:id/download", requireAuth, async (req, res) => {
  const fileId = Number(req.params.id);
  if (Number.isNaN(fileId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [file] = await db.select().from(filesTable)
    .where(and(eq(filesTable.id, fileId), eq(filesTable.userId, res.locals.userId as number)));
  if (!file) { res.status(404).json({ error: "File not found" }); return; }
  try {
    res.redirect(await privateStorage.createDownloadUrl(file.objectPath));
  } catch (error) {
    req.log.error({ err: error }, "private download URL creation failed");
    res.status(500).json({ error: "Unable to retrieve file" });
  }
});

router.delete("/pa/files/:id", requireAuth, async (req, res) => {
  const fileId = Number(req.params.id);
  if (Number.isNaN(fileId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(filesTable).where(and(eq(filesTable.id, fileId), eq(filesTable.userId, res.locals.userId as number)));
  res.status(204).end();
});

// ── Calendar ──────────────────────────────────────────────────────────────────

router.get("/pa/calendar", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as number;
  const [appointments, tasks, leave] = await Promise.all([
    getUserAppointments(userId),
    getUserTasks(userId),
    db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.requesterId, userId)),
  ]);
  res.json({ appointments, tasks, leave });
});

export default router;
