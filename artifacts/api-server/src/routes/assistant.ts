/**
 * POST /rooms/:roomId/assistant/confirm
 * Confirms a leave request from a confirmation_card message.
 * Creates the leave record, posts a system message, and generates a Hook card.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, messagesTable, usersTable, leaveRequestsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { generateHookItems } from "../lib/assistant";

const router: IRouter = Router();

function getCurrentUserId(req: any): number | null {
  const val = req.signedCookies?.userId || req.cookies?.userId;
  const id = parseInt(val, 10);
  return isNaN(id) ? null : id;
}

const ConfirmBody = z.object({
  confirmationMessageId: z.number().int().positive(),
});

const CancelBody = z.object({
  confirmationMessageId: z.number().int().positive(),
});

// ─── Confirm ─────────────────────────────────────────────────────────────────

router.post("/rooms/:roomId/assistant/confirm", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) { res.status(400).json({ error: "Invalid room ID" }); return; }

  const parsed = ConfirmBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Load the confirmation_card message
  const [cardMsg] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, parsed.data.confirmationMessageId), eq(messagesTable.roomId, roomId)));

  if (!cardMsg) { res.status(404).json({ error: "Confirmation card not found" }); return; }
  if (cardMsg.type !== "confirmation_card") { res.status(400).json({ error: "Message is not a confirmation card" }); return; }

  const meta = cardMsg.metadata as any;
  if (meta?.status === "confirmed") { res.status(409).json({ error: "Already confirmed" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const startDate = meta.startDate ?? today;
  const endDate = meta.endDate ?? startDate;
  const studentId: number | null = meta.studentId ?? null;

  // 1. Create the leave request
  const [leave] = await db
    .insert(leaveRequestsTable)
    .values({
      requesterId: userId ?? 1, // fallback to first user
      onBehalfOfId: studentId !== userId ? studentId : null,
      roomId,
      type: meta.leaveType ?? "sick",
      startDate,
      endDate,
      reason: meta.reason ?? "",
      status: "approved",
      approvedById: userId ?? 1,
      approvedAt: new Date(),
    })
    .returning();

  // 2. Mark confirmation card as confirmed
  await db
    .update(messagesTable)
    .set({ metadata: { ...meta, status: "confirmed", leaveRequestId: leave.id } })
    .where(eq(messagesTable.id, cardMsg.id));

  // 3. Format a nice date range
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
  };
  const dateRange = startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
  const leaveLabel = meta.leaveType === "sick" ? "Medical" : meta.leaveType === "personal" ? "Personal" : "Leave";

  // 4. Post system message
  const [sysMsg] = await db
    .insert(messagesTable)
    .values({
      roomId,
      senderId: null,
      type: "system",
      content: `${leaveLabel} leave confirmed for ${meta.studentName} (${dateRange})`,
      metadata: null,
      reactions: [],
    })
    .returning();

  // 5. Generate Hook card (async — fire and forget for speed)
  const hookPromise = (async () => {
    try {
      const items = await generateHookItems(roomId, meta.studentName, startDate);
      await db.insert(messagesTable).values({
        roomId,
        senderId: null,
        type: "hook_card",
        content: `Hook for ${meta.studentName}`,
        metadata: {
          studentId,
          studentName: meta.studentName,
          date: startDate,
          items,
          visibleToStudentId: studentId,
        },
        reactions: [],
      });
    } catch (err) {
      console.error("[assistant] Hook generation error:", err);
    }
  })();

  // Respond immediately; hook arrives on next poll
  res.json({ leaveRequestId: leave.id, systemMessageId: sysMsg.id });

  // Await in background (Node keeps process alive)
  hookPromise.catch(() => {});
});

// ─── Cancel ──────────────────────────────────────────────────────────────────

router.post("/rooms/:roomId/assistant/cancel", async (req, res): Promise<void> => {
  const roomId = parseInt(req.params.roomId, 10);
  if (isNaN(roomId)) { res.status(400).json({ error: "Invalid room ID" }); return; }

  const parsed = CancelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [cardMsg] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, parsed.data.confirmationMessageId), eq(messagesTable.roomId, roomId)));

  if (!cardMsg) { res.status(404).json({ error: "Not found" }); return; }

  const meta = cardMsg.metadata as any;
  await db
    .update(messagesTable)
    .set({ metadata: { ...meta, status: "cancelled" } })
    .where(eq(messagesTable.id, cardMsg.id));

  res.json({ ok: true });
});

export default router;
