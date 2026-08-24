import { Router, type IRouter } from "express";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { db, roomsTable, roomMembersTable, usersTable, messagesTable, attendanceRecordsTable, leaveRequestsTable } from "@workspace/db";
import {
  ListRoomsQueryParams,
  ListRoomsResponse,
  CreateRoomBody,
  CreateRoomResponse,
  GetRoomParams,
  GetRoomResponse,
  GetRoomStatsParams,
  GetRoomStatsResponse,
  GetRoomMembersParams,
  GetRoomMembersResponse,
  AddRoomMemberParams,
  AddRoomMemberBody,
  AddRoomMemberResponse,
  RemoveRoomMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getCurrentUserId(req: any): number | null {
  const val = req.signedCookies?.userId || req.cookies?.userId;
  const id = parseInt(val, 10);
  return isNaN(id) ? null : id;
}

async function requireAdmin(req: any, res: any, next: any): Promise<void> {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  res.locals.userId = userId;
  next();
}

router.get("/rooms", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  const params = ListRoomsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Get rooms the user is a member of (or all rooms if admin)
  let roomIds: number[] = [];
  if (userId) {
    const memberships = await db
      .select({ roomId: roomMembersTable.roomId })
      .from(roomMembersTable)
      .where(eq(roomMembersTable.userId, userId));
    roomIds = memberships.map((m) => m.roomId);
  }

  // Get all rooms (show all for now, filter by membership if needed)
  let roomsQuery = db.select().from(roomsTable);
  const rooms = await roomsQuery.orderBy(desc(roomsTable.createdAt));

  // Enrich with memberCount and last message
  const enriched = await Promise.all(
    rooms.map(async (room) => {
      const [memberCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(roomMembersTable)
        .where(eq(roomMembersTable.roomId, room.id));

      const [lastMsg] = await db
        .select({
          content: messagesTable.content,
          createdAt: messagesTable.createdAt,
          senderName: usersTable.name,
        })
        .from(messagesTable)
        .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
        .where(eq(messagesTable.roomId, room.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      return {
        ...room,
        memberCount: memberCount?.count ?? 0,
        lastMessage: lastMsg?.content ?? null,
        lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
        lastMessageSender: lastMsg?.senderName ?? null,
      };
    })
  );

  // Apply type filter
  const filtered = params.data.type
    ? enriched.filter((r) => r.type === params.data.type)
    : enriched;

  // Apply search filter
  const searched = params.data.search
    ? filtered.filter((r) =>
        r.name.toLowerCase().includes(params.data.search!.toLowerCase())
      )
    : filtered;

  res.json(ListRoomsResponse.parse(searched));
});

router.post("/rooms", requireAdmin, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [room] = await db
    .insert(roomsTable)
    .values({
      name: parsed.data.name,
      type: parsed.data.type as any,
      description: parsed.data.description,
    })
    .returning();

  // Add creator as member
  await db.insert(roomMembersTable).values({ roomId: room.id, userId }).onConflictDoNothing();

  // Add additional members
  if (parsed.data.memberIds && parsed.data.memberIds.length > 0) {
    for (const memberId of parsed.data.memberIds) {
      if (memberId !== userId) {
        await db.insert(roomMembersTable).values({ roomId: room.id, userId: memberId }).onConflictDoNothing();
      }
    }
  }

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(roomMembersTable)
    .where(eq(roomMembersTable.roomId, room.id));

  res.status(201).json(
    CreateRoomResponse.parse({
      ...room,
      memberCount: memberCount?.count ?? 1,
      lastMessage: null,
      lastMessageAt: null,
      lastMessageSender: null,
    })
  );
});

router.patch("/rooms/:roomId", requireAdmin, async (req, res): Promise<void> => {
  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    res.status(400).json({ error: "Invalid room ID" });
    return;
  }
  const parsed = CreateRoomBody.partial().safeParse(req.body);
  if (!parsed.success || !parsed.data.name && !parsed.data.type && parsed.data.description === undefined) {
    res.status(400).json({ error: parsed.success ? "At least one room field is required" : parsed.error.message });
    return;
  }
  const [room] = await db.update(roomsTable).set({
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.type !== undefined ? { type: parsed.data.type as any } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
  }).where(eq(roomsTable.id, roomId)).returning();
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json(room);
});

router.delete("/rooms/:roomId", requireAdmin, async (req, res): Promise<void> => {
  const roomId = Number(req.params.roomId);
  if (Number.isNaN(roomId)) {
    res.status(400).json({ error: "Invalid room ID" });
    return;
  }
  const [room] = await db.delete(roomsTable).where(eq(roomsTable.id, roomId)).returning();
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.status(204).end();
});

router.get("/rooms/:roomId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const params = GetRoomParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [room] = await db.select().from(roomsTable).where(eq(roomsTable.id, params.data.roomId));
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(roomMembersTable)
    .where(eq(roomMembersTable.roomId, room.id));

  const [lastMsg] = await db
    .select({
      content: messagesTable.content,
      createdAt: messagesTable.createdAt,
      senderName: usersTable.name,
    })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.senderId, usersTable.id))
    .where(eq(messagesTable.roomId, room.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);

  res.json(
    GetRoomResponse.parse({
      ...room,
      memberCount: memberCount?.count ?? 0,
      lastMessage: lastMsg?.content ?? null,
      lastMessageAt: lastMsg?.createdAt?.toISOString() ?? null,
      lastMessageSender: lastMsg?.senderName ?? null,
    })
  );
});

router.get("/rooms/:roomId/stats", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const params = GetRoomStatsParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const roomId = params.data.roomId;

  const [memberCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(roomMembersTable)
    .where(eq(roomMembersTable.roomId, roomId));

  const [messageCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messagesTable)
    .where(eq(messagesTable.roomId, roomId));

  const today = new Date().toISOString().slice(0, 10);
  const [todayAttendance] = await db
    .select()
    .from(attendanceRecordsTable)
    .where(and(eq(attendanceRecordsTable.roomId, roomId), eq(attendanceRecordsTable.date, today)));

  const [pendingLeave] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leaveRequestsTable)
    .where(and(eq(leaveRequestsTable.roomId, roomId), eq(leaveRequestsTable.status, "pending")));

  let presentToday: number | null = null;
  let absentToday: number | null = null;
  if (todayAttendance) {
    const entries = (todayAttendance.entries as any[]) || [];
    presentToday = entries.filter((e: any) => e.status === "present").length;
    absentToday = entries.filter((e: any) => e.status === "absent").length;
  }

  res.json(
    GetRoomStatsResponse.parse({
      roomId,
      memberCount: memberCount?.count ?? 0,
      messageCount: messageCount?.count ?? 0,
      attendanceToday: todayAttendance?.id ?? null,
      pendingLeave: pendingLeave?.count ?? 0,
      presentToday,
      absentToday,
    })
  );
});

router.get("/rooms/:roomId/members", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const params = GetRoomMembersParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const members = await db
    .select({
      userId: roomMembersTable.userId,
      roomId: roomMembersTable.roomId,
      joinedAt: roomMembersTable.joinedAt,
      user: {
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
    .from(roomMembersTable)
    .innerJoin(usersTable, eq(roomMembersTable.userId, usersTable.id))
    .where(eq(roomMembersTable.roomId, params.data.roomId));

  res.json(GetRoomMembersResponse.parse(members));
});

router.post("/rooms/:roomId/members", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const params = AddRoomMemberParams.safeParse({ roomId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddRoomMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await db
    .insert(roomMembersTable)
    .values({ roomId: params.data.roomId, userId: parsed.data.userId })
    .onConflictDoNothing();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [member] = await db
    .select({
      userId: roomMembersTable.userId,
      roomId: roomMembersTable.roomId,
      joinedAt: roomMembersTable.joinedAt,
      user: {
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
    .from(roomMembersTable)
    .innerJoin(usersTable, eq(roomMembersTable.userId, usersTable.id))
    .where(
      and(eq(roomMembersTable.roomId, params.data.roomId), eq(roomMembersTable.userId, parsed.data.userId))
    );

  res.status(201).json(AddRoomMemberResponse.parse(member));
});

router.delete("/rooms/:roomId/members/:userId", async (req, res): Promise<void> => {
  const rawRoomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const rawUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const params = RemoveRoomMemberParams.safeParse({
    roomId: parseInt(rawRoomId, 10),
    userId: parseInt(rawUserId, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .delete(roomMembersTable)
    .where(
      and(
        eq(roomMembersTable.roomId, params.data.roomId),
        eq(roomMembersTable.userId, params.data.userId)
      )
    );
  res.sendStatus(204);
});

export default router;
