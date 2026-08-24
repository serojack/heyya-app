/**
 * Heyya Assistant — intent detection and Hook generation.
 * Runs after every user message; silently does nothing if no intent detected.
 */

import { db, messagesTable, usersTable, roomMembersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "./openai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedLeaveIntent {
  studentName: string;
  studentId: number | null;
  leaveType: "sick" | "personal" | "other";
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  duration: string | null;
  reason: string;
  notes: string | null;
}

export interface HookItem {
  id: string;
  category: "lesson" | "assignment" | "upcoming";
  text: string;
  dueDate: string | null;
  checked: boolean;
}

// ─── Intent detection ─────────────────────────────────────────────────────────

/** Quick regex pre-filter — avoids API calls on casual chat. */
const LEAVE_KEYWORDS = [
  "leave", "sick", "doctor", "medical", "dentist", "absent",
  "not coming", "won't be", "will not be", "off today", "unwell",
  "fever", "mc", "appointment", "away", "infection", "ill", "flu",
  "eye", "hospital", "clinic", "medication",
];

const ATTENDANCE_KEYWORDS = [
  "take attendance", "roll call", "who's here", "whos here", "attendance",
];

const ASSIGNMENT_KEYWORDS = [
  "assignments due", "what homework", "any homework", "homework due", "what's due",
];

export function quickClassify(msg: string): "leave" | "attendance" | "assignment" | "none" {
  const lower = msg.toLowerCase();
  if (ATTENDANCE_KEYWORDS.some((k) => lower.includes(k))) return "attendance";
  if (ASSIGNMENT_KEYWORDS.some((k) => lower.includes(k))) return "assignment";
  if (LEAVE_KEYWORDS.some((k) => lower.includes(k))) return "leave";
  return "none";
}

/** Get all students (and their parents) in a room for matching. */
async function getRoomStudents(roomId: number) {
  const rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      role: usersTable.role,
      childId: usersTable.childId,
    })
    .from(roomMembersTable)
    .innerJoin(usersTable, eq(roomMembersTable.userId, usersTable.id))
    .where(eq(roomMembersTable.roomId, roomId));
  return rows;
}

/** Find first-name fuzzy match among students. */
function matchStudent(
  studentName: string,
  members: { id: number; name: string; role: string }[]
) {
  const needle = studentName.toLowerCase().trim();
  const students = members.filter((m) => m.role === "student");

  // Exact full-name match first
  const exact = students.find((s) => s.name.toLowerCase() === needle);
  if (exact) return exact;

  // First-name match
  const firstWord = needle.split(/\s+/)[0];
  const byFirst = students.find((s) =>
    s.name.toLowerCase().startsWith(firstWord)
  );
  if (byFirst) return byFirst;

  // Partial substring
  return students.find((s) => s.name.toLowerCase().includes(firstWord)) ?? null;
}

/** Call GPT to extract leave details from a natural-language message. */
export async function detectLeaveIntent(
  message: string,
  roomId: number
): Promise<ParsedLeaveIntent | null> {
  if (quickClassify(message) !== "leave") return null;

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are a school management assistant that extracts leave request details from parent/student messages.
Today is ${today}.

Return JSON with this shape (no markdown, just raw JSON):
{
  "isLeaveRequest": boolean,
  "studentName": string | null,   // First + Last if mentioned, or just first name
  "leaveType": "sick" | "personal" | "other",
  "startDate": "YYYY-MM-DD",     // use today if "today" mentioned
  "endDate": "YYYY-MM-DD",       // same as start if 1 day; add duration if mentioned
  "duration": string | null,      // e.g. "2-3 days"
  "reason": string,               // concise reason
  "notes": string | null          // extra notes like "will produce MC"
}

Rules:
- "medical" / "doctor" / "sick" / "fever" / "dentist" / "eye" → leaveType "sick"
- "family" / "trip" / "travel" / "wedding" / "personal" → leaveType "personal"
- If no clear student name, studentName = null
- If no end date mentioned, endDate = startDate + (duration - 1 days) if duration given, else = startDate
- ALWAYS return valid JSON`;

  let raw = "";
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });
    raw = resp.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("[assistant] OpenAI error:", err);
    return null;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed.isLeaveRequest) return null;

  // Match student in room
  const members = await getRoomStudents(roomId);
  const matched = parsed.studentName ? matchStudent(parsed.studentName, members) : null;

  return {
    studentName: matched?.name ?? parsed.studentName ?? "Unknown Student",
    studentId: matched?.id ?? null,
    leaveType: (["sick", "personal", "other"].includes(parsed.leaveType) ? parsed.leaveType : "sick") as any,
    startDate: parsed.startDate ?? today,
    endDate: parsed.endDate ?? parsed.startDate ?? today,
    duration: parsed.duration ?? null,
    reason: parsed.reason ?? message,
    notes: parsed.notes ?? null,
  };
}

// ─── Hook generation ──────────────────────────────────────────────────────────

/** Scan recent room messages for assignment/lesson keywords. */
async function scanRoomForAssignments(roomId: number): Promise<string[]> {
  const recent = await db
    .select({ content: messagesTable.content, type: messagesTable.type })
    .from(messagesTable)
    .where(eq(messagesTable.roomId, roomId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(100);

  const KEYWORDS = [
    "homework", "assignment", "due", "worksheet", "quiz", "test",
    "project", "chapter", "exercise", "submit", "deadline", "lesson",
    "covered", "today we", "class today",
  ];

  return recent
    .filter(
      (m) =>
        m.type === "text" &&
        KEYWORDS.some((k) => m.content.toLowerCase().includes(k))
    )
    .map((m) => m.content)
    .slice(0, 10);
}

/** Generate Hook items using GPT based on room activity. */
export async function generateHookItems(
  roomId: number,
  studentName: string,
  leaveDate: string
): Promise<HookItem[]> {
  const snippets = await scanRoomForAssignments(roomId);

  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are a school assistant generating a "catch-up hook" for a student who is absent.
Today is ${today}, the student's leave date is ${leaveDate}.

Based on the chat messages below (from the class room), extract:
- Lessons covered (category "lesson")
- Assignments/homework due (category "assignment", include dueDate if mentioned)
- Upcoming tests/events (category "upcoming", include dueDate if mentioned)

Return a JSON array of items (max 8):
[{ "category": "lesson"|"assignment"|"upcoming", "text": string, "dueDate": "YYYY-MM-DD"|null }]

If no messages found, return 1 item: [{ "category": "lesson", "text": "No assignments posted yet. Check back later or ask your teacher.", "dueDate": null }]

ONLY return a JSON array, no markdown.`;

  const userContent = snippets.length
    ? `Class messages:\n${snippets.join("\n")}`
    : "(No recent messages with lesson/assignment content found.)";

  let raw = "[]";
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });
    // GPT wraps arrays in a json_object; handle both {"items":[...]} and [...]
    const content = resp.choices[0]?.message?.content ?? "{}";
    const obj = JSON.parse(content);
    raw = JSON.stringify(Array.isArray(obj) ? obj : (obj.items ?? obj.data ?? []));
  } catch (err) {
    console.error("[assistant] Hook generation error:", err);
  }

  let items: any[] = [];
  try {
    items = JSON.parse(raw);
  } catch {
    items = [];
  }

  if (!Array.isArray(items) || items.length === 0) {
    items = [
      {
        category: "lesson",
        text: "No assignments posted yet. Check back later or ask your teacher.",
        dueDate: null,
      },
    ];
  }

  return items.map((item: any, i: number) => ({
    id: `item-${Date.now()}-${i}`,
    category: item.category ?? "lesson",
    text: item.text ?? "",
    dueDate: item.dueDate ?? null,
    checked: false,
  }));
}

// ─── Message helpers ──────────────────────────────────────────────────────────

/** Insert the assistant's confirmation card into the room. */
export async function postConfirmationCard(
  roomId: number,
  intent: ParsedLeaveIntent
): Promise<void> {
  const label =
    intent.leaveType === "sick"
      ? "Medical Leave"
      : intent.leaveType === "personal"
      ? "Personal Leave"
      : "Leave";

  await db.insert(messagesTable).values({
    roomId,
    senderId: null,
    type: "confirmation_card",
    content: `Leave request detected for ${intent.studentName}`,
    metadata: {
      studentName: intent.studentName,
      studentId: intent.studentId,
      leaveType: intent.leaveType,
      startDate: intent.startDate,
      endDate: intent.endDate,
      duration: intent.duration,
      reason: intent.reason,
      notes: intent.notes,
      label,
      status: "pending",
    },
    reactions: [],
  });
}

/** Full pipeline: detect → post confirmation card. Called async after message send. */
export async function processMessageIntent(
  content: string,
  roomId: number
): Promise<void> {
  const intent = await detectLeaveIntent(content, roomId);
  if (!intent) return;
  await postConfirmationCard(roomId, intent);
}
