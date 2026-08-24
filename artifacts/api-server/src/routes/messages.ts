import { Router, type IRouter } from "express";
import { eq, and, lt, desc } from "drizzle-orm";
import { db, messagesTable, usersTable } from "@workspace/db";
import { processMessageIntent } from "../lib/assistant";
import {
  ListMessagesParams,
  ListMessagesQueryParams,
  ListMessagesResponse,
  SendMessageParams,
  SendMessageBody,
  SendMessageResponse,
  AddReactionParams,
  AddReactionBody,
  AddReactionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getCurrentUserId(req: any): number | null {
  const val = req.signedCookies?.userId || req.cookies?.userId;
  const id = parseInt(val, 10);
  return isNaN(id) ? null : id;
}

async function getMessageWithSender(id: number) {
  const [msg] = await db
    .select({
      id: messagesTable.id,
      roomId: messagesTable.roomId,
      senderId: messagesTable.senderId,
      type: messagesTable.type,
      content: messagesTable.content,
      metadata: messagesTable.metadata,
      reactions: messagesTable.reactions,
      createdAt: messagesTable.createdAt,
      sender: {
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        avatarUrl: usersTable.avatarUrl,
        status: usersTable.status,
        childId: usersTable.childId,
        createdAt: usersTable.createdAt,
      },
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.id, id));
  return msg;
}

router.get("/rooms/:roomId/messages", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const pathParams = ListMessagesParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }
  const queryParams = ListMessagesQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const limit = queryParams.data.limit ?? 50;
  const roomId = pathParams.data.roomId;

  let query = db
    .select({
      id: messagesTable.id,
      roomId: messagesTable.roomId,
      senderId: messagesTable.senderId,
      type: messagesTable.type,
      content: messagesTable.content,
      metadata: messagesTable.metadata,
      reactions: messagesTable.reactions,
      createdAt: messagesTable.createdAt,
      sender: {
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        avatarUrl: usersTable.avatarUrl,
        status: usersTable.status,
        childId: usersTable.childId,
        createdAt: usersTable.createdAt,
      },
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .$dynamic();

  const conditions = [eq(messagesTable.roomId, roomId)];

  if (queryParams.data.before) {
    const beforeDate = new Date(queryParams.data.before);
    conditions.push(lt(messagesTable.createdAt, beforeDate));
  }

  const messages = await query
    .where(and(...conditions))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);

  // Return in chronological order (oldest first)
  res.json(ListMessagesResponse.parse(messages.reverse()));
});

router.post("/rooms/:roomId/messages", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const pathParams = SendMessageParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!pathParams.success) {
    res.status(400).json({ error: pathParams.error.message });
    return;
  }
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [msg] = await db
    .insert(messagesTable)
    .values({
      roomId: pathParams.data.roomId,
      senderId: userId ?? undefined,
      type: (parsed.data.type ?? "text") as any,
      content: parsed.data.content,
      metadata: parsed.data.metadata,
      reactions: [],
    })
    .returning();

  const full = await getMessageWithSender(msg.id);
  res.status(201).json(SendMessageResponse.parse(full));

  // Fire-and-forget: detect leave/attendance intent and post assistant card
  if (parsed.data.type === "text" || !parsed.data.type) {
    setImmediate(() => {
      processMessageIntent(parsed.data.content, pathParams.data.roomId).catch(() => {});
    });
  }
});

router.post("/rooms/:roomId/messages/:messageId/reactions", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const rawRoomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const rawMsgId = Array.isArray(req.params.messageId) ? req.params.messageId[0] : req.params.messageId;

  const params = AddReactionParams.safeParse({
    roomId: parseInt(rawRoomId, 10),
    messageId: parseInt(rawMsgId, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddReactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.messageId));
  if (!msg) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const reactions = ((msg.reactions as any[]) ?? []) as { emoji: string; userIds: number[] }[];
  const existing = reactions.find((r) => r.emoji === parsed.data.emoji);

  if (existing) {
    if (userId && existing.userIds.includes(userId)) {
      // Remove reaction (toggle off)
      existing.userIds = existing.userIds.filter((id) => id !== userId);
      if (existing.userIds.length === 0) {
        reactions.splice(reactions.indexOf(existing), 1);
      }
    } else if (userId) {
      existing.userIds.push(userId);
    }
  } else if (userId) {
    reactions.push({ emoji: parsed.data.emoji, userIds: [userId] });
  }

  await db.update(messagesTable).set({ reactions }).where(eq(messagesTable.id, params.data.messageId));

  const full = await getMessageWithSender(msg.id);
  res.json(AddReactionResponse.parse(full));
});

export default router;
