import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, leaveRequestsTable, usersTable, messagesTable } from "@workspace/db";
import {
  ListLeaveRequestsQueryParams,
  ListLeaveRequestsResponse,
  CreateLeaveRequestBody,
  CreateLeaveRequestResponse,
  GetLeaveRequestParams,
  GetLeaveRequestResponse,
  UpdateLeaveRequestParams,
  UpdateLeaveRequestBody,
  UpdateLeaveRequestResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getCurrentUserId(req: any): number | null {
  const val = req.signedCookies?.userId || req.cookies?.userId;
  const id = parseInt(val, 10);
  return isNaN(id) ? null : id;
}

async function enrichLeaveRequest(leave: any) {
  const [requester] = await db.select().from(usersTable).where(eq(usersTable.id, leave.requesterId));

  let onBehalfOf = null;
  if (leave.onBehalfOfId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, leave.onBehalfOfId));
    onBehalfOf = u ?? null;
  }

  let approvedBy = null;
  if (leave.approvedById) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, leave.approvedById));
    approvedBy = u ?? null;
  }

  return {
    ...leave,
    approvedAt: leave.approvedAt?.toISOString() ?? null,
    requester: requester ?? null,
    ...(onBehalfOf ? { onBehalfOf } : {}),
    approvedBy,
  };
}

router.get("/leave-requests", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const params = ListLeaveRequestsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let records = await db.select().from(leaveRequestsTable).orderBy(leaveRequestsTable.createdAt);

  if (params.data.status) {
    records = records.filter((r) => r.status === params.data.status);
  }
  if (params.data.roomId) {
    records = records.filter((r) => r.roomId === params.data.roomId);
  }

  const enriched = await Promise.all(records.map(enrichLeaveRequest));
  res.json(ListLeaveRequestsResponse.parse(enriched));
});

router.post("/leave-requests", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const parsed = CreateLeaveRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [leave] = await db
    .insert(leaveRequestsTable)
    .values({
      requesterId: userId,
      onBehalfOfId: parsed.data.onBehalfOfId,
      roomId: parsed.data.roomId,
      type: parsed.data.type as any,
      startDate: parsed.data.startDate instanceof Date
        ? parsed.data.startDate.toISOString().slice(0, 10)
        : String(parsed.data.startDate).slice(0, 10),
      endDate: parsed.data.endDate instanceof Date
        ? parsed.data.endDate.toISOString().slice(0, 10)
        : String(parsed.data.endDate).slice(0, 10),
      reason: parsed.data.reason,
      status: "pending",
    })
    .returning();

  // If a room is specified, post a leave_card message in the room
  if (parsed.data.roomId && leave) {
    const [requester] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const [msg] = await db
      .insert(messagesTable)
      .values({
        roomId: parsed.data.roomId,
        senderId: userId,
        type: "leave_card",
        content: `Leave request submitted by ${requester?.name ?? "Unknown"}`,
        metadata: { leaveId: leave.id },
        reactions: [],
      })
      .returning();

    await db
      .update(leaveRequestsTable)
      .set({ messageId: msg.id })
      .where(eq(leaveRequestsTable.id, leave.id));
  }

  const updated = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, leave.id));
  const enriched = await enrichLeaveRequest(updated[0]);
  res.status(201).json(CreateLeaveRequestResponse.parse(enriched));
});

router.get("/leave-requests/:leaveId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.leaveId) ? req.params.leaveId[0] : req.params.leaveId;
  const params = GetLeaveRequestParams.safeParse({ leaveId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [leave] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, params.data.leaveId));
  if (!leave) {
    res.status(404).json({ error: "Leave request not found" });
    return;
  }
  const enriched = await enrichLeaveRequest(leave);
  res.json(GetLeaveRequestResponse.parse(enriched));
});

router.patch("/leave-requests/:leaveId", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const rawId = Array.isArray(req.params.leaveId) ? req.params.leaveId[0] : req.params.leaveId;
  const params = UpdateLeaveRequestParams.safeParse({ leaveId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLeaveRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [leave] = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, params.data.leaveId));
  if (!leave) {
    res.status(404).json({ error: "Leave request not found" });
    return;
  }

  const updates: Record<string, unknown> = {
    status: parsed.data.status,
  };
  if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
    updates.approvedById = userId;
    updates.approvedAt = new Date();
  }

  const [updated] = await db
    .update(leaveRequestsTable)
    .set(updates)
    .where(eq(leaveRequestsTable.id, params.data.leaveId))
    .returning();

  // Update the leave_card message if exists
  if (leave.messageId) {
    await db
      .update(messagesTable)
      .set({
        metadata: {
          leaveId: leave.id,
          status: parsed.data.status,
        },
      })
      .where(eq(messagesTable.id, leave.messageId));
  }

  const enriched = await enrichLeaveRequest(updated);
  res.json(UpdateLeaveRequestResponse.parse(enriched));
});

export default router;
