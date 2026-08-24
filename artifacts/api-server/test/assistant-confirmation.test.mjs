import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import pg from "../../../lib/db/node_modules/pg/esm/index.mjs";
import app from "../dist/app.mjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const server = createServer(app);
let baseUrl;
let roomId;
let userId;
const createdCardIds = [];
const createdLeaveIds = [];
const createdMessageIds = [];

async function query(text, values = []) {
  return pool.query(text, values);
}

async function post(path, body, user = userId) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `userId=${user}`,
    },
    body: JSON.stringify(body),
  });
}

async function createConfirmationCard(metadata) {
  const result = await query(
    `INSERT INTO messages (room_id, sender_id, type, content, metadata, reactions)
     VALUES ($1, $2, 'confirmation_card', 'Test leave confirmation', $3::jsonb, '[]'::jsonb)
     RETURNING id`,
    [roomId, userId, JSON.stringify(metadata)],
  );
  const id = result.rows[0].id;
  createdCardIds.push(id);
  return id;
}

before(async () => {
  const [room, user] = await Promise.all([
    query("SELECT id FROM rooms ORDER BY id LIMIT 1"),
    query("SELECT id FROM users ORDER BY id LIMIT 1"),
  ]);
  assert.ok(room.rows[0], "the test database must contain a room");
  assert.ok(user.rows[0], "the test database must contain a user");
  roomId = room.rows[0].id;
  userId = user.rows[0].id;

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  // Hook generation is intentionally fire-and-forget in the route.
  await new Promise((resolve) => setTimeout(resolve, 100));
  const messageIds = [...createdCardIds, ...createdMessageIds];
  await query(
    "DELETE FROM messages WHERE id = ANY($1::int[])",
    [messageIds],
  );
  if (createdLeaveIds.length > 0) {
    await query(
      "DELETE FROM leave_requests WHERE id = ANY($1::int[])",
      [createdLeaveIds],
    );
  }
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
});

test("confirming a pending card creates one leave request and system message", async () => {
  const cardId = await createConfirmationCard({
    studentName: "Test Student",
    studentId: null,
    leaveType: "sick",
    startDate: "2026-09-10",
    endDate: "2026-09-11",
    reason: "Regression test",
    status: "pending",
  });

  const response = await post(`/rooms/${roomId}/assistant/confirm`, {
    confirmationMessageId: cardId,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.leaveRequestId, "number");
  assert.equal(typeof body.systemMessageId, "number");
  createdLeaveIds.push(body.leaveRequestId);
  createdMessageIds.push(body.systemMessageId);

  const [leave, card, systemMessage] = await Promise.all([
    query("SELECT * FROM leave_requests WHERE id = $1", [body.leaveRequestId]),
    query("SELECT metadata FROM messages WHERE id = $1", [cardId]),
    query("SELECT type, content, sender_id FROM messages WHERE id = $1", [
      body.systemMessageId,
    ]),
  ]);
  assert.equal(leave.rowCount, 1);
  assert.deepEqual(
    {
      type: leave.rows[0].type,
      startDate: leave.rows[0].start_date,
      endDate: leave.rows[0].end_date,
      reason: leave.rows[0].reason,
      status: leave.rows[0].status,
    },
    {
      type: "sick",
      startDate: new Date("2026-09-10T00:00:00.000Z"),
      endDate: new Date("2026-09-11T00:00:00.000Z"),
      reason: "Regression test",
      status: "approved",
    },
  );
  assert.equal(card.rows[0].metadata.status, "confirmed");
  assert.equal(card.rows[0].metadata.leaveRequestId, body.leaveRequestId);
  assert.equal(systemMessage.rows[0].type, "system");
  assert.equal(
    systemMessage.rows[0].content,
    "Medical leave confirmed for Test Student (10 Sep – 11 Sep)",
  );
  assert.equal(systemMessage.rows[0].sender_id, null);
});

test("confirming an already confirmed card returns a conflict without duplicating", async () => {
  const cardId = await createConfirmationCard({
    studentName: "Already Confirmed Student",
    leaveType: "personal",
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    reason: "Already processed",
    status: "confirmed",
  });

  const beforeCount = await query(
    "SELECT count(*)::int AS count FROM leave_requests WHERE room_id = $1",
    [roomId],
  );
  const response = await post(`/rooms/${roomId}/assistant/confirm`, {
    confirmationMessageId: cardId,
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "Already confirmed" });

  const afterCount = await query(
    "SELECT count(*)::int AS count FROM leave_requests WHERE room_id = $1",
    [roomId],
  );
  assert.equal(afterCount.rows[0].count, beforeCount.rows[0].count);
});

test("cancelling a confirmation card persists the cancelled status", async () => {
  const cardId = await createConfirmationCard({
    studentName: "Cancelled Student",
    leaveType: "other",
    startDate: "2026-09-13",
    endDate: "2026-09-13",
    reason: "No longer needed",
    status: "pending",
  });

  const response = await post(`/rooms/${roomId}/assistant/cancel`, {
    confirmationMessageId: cardId,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });

  const card = await query("SELECT metadata FROM messages WHERE id = $1", [
    cardId,
  ]);
  assert.equal(card.rows[0].metadata.status, "cancelled");
});