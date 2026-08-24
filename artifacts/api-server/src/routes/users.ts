import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
  ListUsersQueryParams,
  ListUsersResponse,
  GetUserParams,
  GetUserResponse,
  DemoLoginBody,
  DemoLoginResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getCurrentUserId(req: any): number | null {
  const val = req.signedCookies?.userId || req.cookies?.userId;
  const id = parseInt(val, 10);
  return isNaN(id) ? null : id;
}

export function requireAuth(req: any, res: any, next: any): void {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  res.locals.userId = userId;
  next();
}

router.get("/users/me", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(GetMeResponse.parse(user));
});

router.patch("/users/me", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(UpdateMeResponse.parse(user));
});

router.get("/users", async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  let query = db.select().from(usersTable);
  const conditions = [];
  if (params.data.role) {
    conditions.push(eq(usersTable.role, params.data.role as any));
  }
  if (params.data.search) {
    const search = `%${params.data.search}%`;
    conditions.push(or(ilike(usersTable.name, search), ilike(usersTable.email, search)));
  }
  const users = conditions.length > 0
    ? await db.select().from(usersTable).where(conditions.length === 1 ? conditions[0] : conditions[0])
    : await db.select().from(usersTable);
  res.json(ListUsersResponse.parse(users));
});

router.get("/users/:userId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const params = GetUserParams.safeParse({ userId: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetUserResponse.parse(user));
});

router.post("/users/demo-login", async (req, res): Promise<void> => {
  const parsed = DemoLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let user;
  if (parsed.data.userId) {
    const [found] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
    user = found;
  }

  if (!user) {
    // Find first user with requested role
    const [found] = await db.select().from(usersTable).where(eq(usersTable.role, parsed.data.role as any));
    user = found;
  }

  if (!user) {
    res.status(404).json({ error: "No demo user found for that role" });
    return;
  }

  // Update status to online
  await db.update(usersTable).set({ status: "online" }).where(eq(usersTable.id, user.id));
  user.status = "online";

  // Set cookie (signed)
  res.cookie("userId", String(user.id), {
    httpOnly: true,
    signed: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: "lax",
  });

  res.json(DemoLoginResponse.parse(user));
});

router.post("/users/logout", async (req, res): Promise<void> => {
  res.clearCookie("userId");
  res.json({ ok: true });
});

export default router;
