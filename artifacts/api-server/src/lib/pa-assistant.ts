/**
 * Heyya PA — Personal Assistant intent parsing and action execution.
 * Parses natural-language messages into structured intents, then executes confirmed actions.
 */

import { db, usersTable, appointmentsTable, savedLinksTable, leaveRequestsTable, tasksTable, notesTable, filesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "./openai";

// ─── Intent types ──────────────────────────────────────────────────────────────

export type PAIntentType = "leave" | "appointment" | "task" | "note" | "link" | "file_note" | "notify" | "chat" | "unclear";

export interface PALeaveDetails {
  leaveType: "sick" | "personal" | "other";
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  reason: string;
  onBehalfOfName?: string | null;
}

export interface PAAppointmentDetails {
  title: string;
  date: string;        // YYYY-MM-DD
  time?: string | null; // HH:MM
  location?: string | null;
  notes?: string | null;
  isReminder?: boolean;
}

export interface PALinkDetails {
  url: string;
  title?: string | null;
  category?: string | null;
  notes?: string | null;
}

export interface PAFileNoteDetails {
  filename: string;
  folder: string;
  mediaType: "image" | "video" | "document" | "audio" | "other";
  notes?: string | null;
}

export interface PANotifyDetails {
  recipient: string;     // name or role ("HR", "teacher", "parent")
  subject: string;
  message: string;
}

export interface PATaskDetails {
  title: string;
  category?: string | null;
  dueDate?: string | null;
  priority?: "low" | "medium" | "high";
  notes?: string | null;
  folder?: string | null;
  reminder?: boolean;
  needsDocuments?: boolean;
}

export interface PANoteDetails {
  content: string;
  topic?: string | null;
  folder?: string | null;
  reminder?: boolean;
  reminderDate?: string | null;
}

export interface PAChatDetails {
  answer: string;
}

export interface PAUnclearDetails {
  clarifyQuestion: string;
}

export type PADetails =
  | PALeaveDetails
  | PAAppointmentDetails
  | PALinkDetails
  | PAFileNoteDetails
  | PANotifyDetails
  | PATaskDetails
  | PANoteDetails
  | PAChatDetails
  | PAUnclearDetails;

export interface PAParseResult {
  type: PAIntentType;
  requiresConfirmation: boolean;
  paMessage: string;         // what the PA says in chat
  confirmText?: string;      // summary shown on confirmation card
  confirmTitle?: string;
  details: PADetails;
}

export interface PAExecuteResult {
  success: boolean;
  paMessage: string;
  data?: unknown;
}

// ─── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(userName: string, userRole: string, today: string): string {
  return `You are Heyya, an intelligent personal assistant for Goldeen Park High School.
Today is ${today}. You are helping ${userName} (${userRole}).

Your job is to parse the user's message and return ONLY valid JSON (no markdown, no explanation):
{
  "type": "leave" | "appointment" | "link" | "file_note" | "notify" | "chat" | "unclear",
  "requiresConfirmation": boolean,
  "paMessage": string,
  "confirmText": string | null,
  "confirmTitle": string | null,
  "details": object
}

INTENT RULES:

type = "leave": User wants to apply for leave (sick, personal, medical, doctor, dentist, absent, away)
  details: { "leaveType": "sick"|"personal"|"other", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "reason": string, "onBehalfOfName": string|null }
  requiresConfirmation: true
  confirmTitle: "Leave Application"
  confirmText: human-readable summary e.g. "Apply for sick leave from 2026-08-20 to 2026-08-21. Reason: Fever and rest."

type = "appointment": User wants to schedule a meeting, event, appointment, reminder
  details: { "title": string, "date": "YYYY-MM-DD", "time": "HH:MM"|null, "location": string|null, "notes": string|null, "isReminder": boolean }
  requiresConfirmation: true
  confirmTitle: "New Appointment"
  confirmText: human-readable summary e.g. "Schedule 'Parent-Teacher Meeting' on 2026-08-25 at 14:00 at Room 12."
  isReminder = true if user says "remind me" without a specific event context

type = "link": User wants to save a URL, link, or website
  details: { "url": string, "title": string|null, "category": string|null, "notes": string|null }
  requiresConfirmation: true
  confirmTitle: "Save Link"
  confirmText: human-readable summary

type = "file_note": User mentions saving/uploading an image, video, document, audio file to a folder
  details: { "filename": string, "folder": string, "mediaType": "image"|"video"|"document"|"audio"|"other", "notes": string|null }
  requiresConfirmation: true
  confirmTitle: "Save File"
  confirmText: human-readable summary

type = "notify": User wants to send a notification/message to someone (HR, a teacher, a parent)
  details: { "recipient": string, "subject": string, "message": string }
  requiresConfirmation: true
  confirmTitle: "Send Notification"
  confirmText: human-readable summary

type = "chat": General question or casual conversation — no action needed
  details: { "answer": string }
  requiresConfirmation: false
  paMessage: direct, helpful answer

type = "unclear": Cannot determine intent, need more info
  details: { "clarifyQuestion": string }
  requiresConfirmation: false
  paMessage: polite question for clarification

RULES:
- "today" = ${today}
- "next week" = +7 days from today
- "tomorrow" = +1 day from today
- For leave: if only start date given, endDate = startDate (1 day)
- URLs must start with http/https; if user gives a bare domain, prepend https://
- paMessage should be warm, professional, and conversational (1-3 sentences max)
- confirmText should be concise and human-readable (1-2 sentences)
- ALWAYS return valid JSON`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function relativeDate(message: string): string {
  const today = new Date();
  const lower = message.toLowerCase();
  if (lower.includes("tomorrow")) {
    today.setDate(today.getDate() + 1);
    return toIsoDate(today);
  }
  if (lower.includes("next week")) {
    today.setDate(today.getDate() + 7);
    return toIsoDate(today);
  }
  return toIsoDate(today);
}

function normalizeTime(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const period = match[3];
  if (period === "pm" && hour !== 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

/**
 * Handles explicit, low-ambiguity commands without waiting on the LLM.
 * This also keeps core school workflows usable if the external model is
 * temporarily unavailable.
 */
function parseClearIntent(message: string): PAParseResult | null {
  const lower = message.toLowerCase();
  const date = relativeDate(message);

  if (/\b(task|assignment|homework|to-do|todo)\b/i.test(message)) {
    const title = message
      .replace(/^(please\s+)?(create|add|make|set|assign)?\s*(a\s+)?(task|assignment|homework|to-do|todo)?\s*:?\s*/i, "")
      .trim() || "New task";
    return {
      type: "task",
      requiresConfirmation: false,
      paMessage: "I can organise that as a task. I need a few details first — what is it for, when is it due, how important is it, and should I remind you or attach any documents?",
      details: { title },
    };
  }

  if (/\b(note|notes|rough note|jot down)\b/i.test(message)) {
    const content = message.replace(/^(please\s+)?(add|save|create|jot down)?\s*(a\s+)?(rough\s+)?notes?\s*:?\s*/i, "").trim();
    return {
      type: "note",
      requiresConfirmation: false,
      paMessage: "Let’s make that useful. What is this note about, where should I organise it, and do you want a reminder attached?",
      details: { content: content || "" },
    };
  }

  const urlMatch = message.match(/https?:\/\/[^\s]+|(?:www\.)[^\s]+/i);
  if (urlMatch && /(save|keep|bookmark|link|url|website)/i.test(message)) {
    const url = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
    const categoryMatch = message.match(/(?:as|category)\s+(?:a[n]?\s+)?([^.!]+?)(?:\.|$)/i);
    const category = categoryMatch?.[1]?.replace(/\s+(resource|link)$/i, " resource") ?? "saved link";
    return {
      type: "link",
      requiresConfirmation: true,
      paMessage: "I found that link. Here’s how I’ll organise it:",
      confirmTitle: "Save Link",
      confirmText: `Save ${url} in your library${category ? ` as ${category.trim()}` : ""}.`,
      details: { url, title: null, category: category.trim(), notes: null },
    };
  }

  if (/(save|organise|organize|upload).*(image|video|file|document|photo|\.png|\.jpg|\.jpeg|\.mp4|\.mov|\.pdf)/i.test(message)) {
    const filenameMatch = message.match(/(?:file|image|video|document|photo)\s+["']?([^"'\n]+?\.(?:png|jpe?g|gif|webp|mp4|mov|avi|pdf|docx?|xlsx?))["']?/i)
      ?? message.match(/([A-Za-z0-9._-]+\.(?:png|jpe?g|gif|webp|mp4|mov|avi|pdf|docx?|xlsx?))/i);
    const folderMatch = message.match(/(?:in|into|to)\s+(?:the\s+)?(.+?)(?:\s+folder|[.!]?$)/i);
    const filename = filenameMatch?.[1]?.trim() ?? "attachment";
    const folder = folderMatch?.[1]?.trim() ?? "Inbox";
    const extension = filename.split(".").pop()?.toLowerCase() ?? "";
    const mediaType = ["png", "jpg", "jpeg", "gif", "webp"].includes(extension) ? "image"
      : ["mp4", "mov", "avi"].includes(extension) ? "video"
      : ["pdf", "doc", "docx", "xls", "xlsx"].includes(extension) ? "document" : "other";
    return {
      type: "file_note",
      requiresConfirmation: true,
      paMessage: "I can organise that file record for you:",
      confirmTitle: "Save File",
      confirmText: `Save ${filename} in the ${folder} folder as a ${mediaType}.`,
      details: { filename, folder, mediaType, notes: null },
    };
  }

  if (/(leave|sick|medical|doctor|dentist|absent|unwell|fever)/i.test(message) && /(need|apply|request|want|take|i'm|i am|i’ll|i'll)/i.test(message)) {
    const leaveType = /(sick|medical|doctor|dentist|unwell|fever)/i.test(message) ? "sick" : "personal";
    const reasonMatch = message.match(/(?:because|for|due to)\s+(.+?)(?:[.!]?$)/i);
    const reason = reasonMatch?.[1]?.trim() ?? (leaveType === "sick" ? "Medical appointment" : "Personal leave");
    return {
      type: "leave",
      requiresConfirmation: true,
      paMessage: "I’ve prepared your leave application. Please review it before I submit it.",
      confirmTitle: "Leave Application",
      confirmText: `Apply for ${leaveType} leave on ${date}. Reason: ${reason}.`,
      details: { leaveType, startDate: date, endDate: date, reason, onBehalfOfName: null },
    };
  }

  if (/(schedule|book|set up|create|remind me).*(meeting|appointment|reminder|call|event)|^(schedule|book|remind me)/i.test(message)) {
    const timeMatch = message.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
    const locationMatch = message.match(/\b(?:at|in)\s+((?:room|office|hall|library)\b[^.,!]*|online|zoom)(?=[.,!]|$)/i);
    const title = message
      .replace(/^(please\s+)?(schedule|book|set up|create|remind me to)\s*/i, "")
      .replace(/\b(today|tomorrow|next week)\b/gi, "")
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
      .replace(/\b(?:at|in)\s+(?:room|office|hall|library|online|zoom)[^.,!]*/gi, "")
      .replace(/\s+/g, " ")
      .replace(/[.,!]+$/g, "")
      .replace(/\s+(?:at|in)\s*$/i, "")
      .trim()
      .replace(/^./, (char) => char.toUpperCase()) || "New appointment";
    const time = normalizeTime(timeMatch?.[1]);
    const location = locationMatch?.[1]?.trim() ?? null;
    return {
      type: "appointment",
      requiresConfirmation: true,
      paMessage: "I’ve drafted this for your schedule. Confirm when it looks right:",
      confirmTitle: "New Appointment",
      confirmText: `Schedule “${title}” on ${date}${time ? ` at ${time}` : ""}${location ? ` in ${location}` : ""}.`,
      details: { title, date, time, location, notes: null, isReminder: /remind me/i.test(message) },
    };
  }

  if (/(notify|message|tell|send).*(hr|teacher|parent|principal|admin)/i.test(message)) {
    const recipientMatch = message.match(/\b(hr|teacher|parent|principal|admin(?:istration)?)/i);
    const recipient = recipientMatch?.[1]?.toUpperCase() ?? "Recipient";
    return {
      type: "notify",
      requiresConfirmation: true,
      paMessage: "I can send that notification for you. Please check the summary:",
      confirmTitle: "Send Notification",
      confirmText: `Send a notification to ${recipient}.`,
      details: { recipient, subject: "Heyya notification", message },
    };
  }

  return null;
}

// ─── Parse intent ──────────────────────────────────────────────────────────────

export async function parseIntent(
  message: string,
  userId: number
): Promise<PAParseResult> {
  const quickResult = parseClearIntent(message);
  if (quickResult) return quickResult;

  const today = new Date().toISOString().slice(0, 10);

  // Get user info for context
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const userName = user?.name ?? "User";
  const userRole = user?.role ?? "staff";

  const systemPrompt = buildSystemPrompt(userName, userRole, today);

  let raw = "";
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });
    raw = resp.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    console.error("[pa-assistant] OpenAI error:", err);
    return {
      type: "unclear",
      requiresConfirmation: false,
      paMessage: "I can help with scheduling, leave applications, saved links, file organisation, and notifications. Could you tell me what you’d like to organise?",
      details: { clarifyQuestion: "What would you like to organise?" },
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      type: "chat",
      requiresConfirmation: false,
      paMessage: "I didn't quite catch that. Could you rephrase?",
      details: { answer: "" },
    };
  }

  return {
    type: parsed.type ?? "chat",
    requiresConfirmation: parsed.requiresConfirmation ?? false,
    paMessage: parsed.paMessage ?? "Got it!",
    confirmText: parsed.confirmText ?? undefined,
    confirmTitle: parsed.confirmTitle ?? undefined,
    details: parsed.details ?? {},
  };
}

// ─── Execute confirmed action ──────────────────────────────────────────────────

export async function executeAction(
  type: PAIntentType,
  details: PADetails,
  userId: number
): Promise<PAExecuteResult> {
  try {
    switch (type) {
      case "leave": {
        const d = details as PALeaveDetails;
        const lr = await db.insert(leaveRequestsTable).values({
          requesterId: userId,
          type: d.leaveType,
          startDate: d.startDate,
          endDate: d.endDate,
          reason: d.reason,
          status: "pending",
        }).returning();
        return {
          success: true,
          paMessage: `Your leave application has been submitted! ✅\n**${formatDateRange(d.startDate, d.endDate)}** — ${d.reason}\n\nYou'll receive a notification once it's reviewed.`,
          data: lr[0],
        };
      }

      case "appointment": {
        const d = details as PAAppointmentDetails;
        const apt = await db.insert(appointmentsTable).values({
          userId,
          title: d.title,
          date: d.date,
          time: d.time ?? null,
          location: d.location ?? null,
          notes: d.notes ?? null,
          isReminder: d.isReminder ?? false,
          inviteStatus: "not_sent",
        }).returning();
        const label = (d.isReminder) ? "Reminder" : "Appointment";
        return {
          success: true,
          paMessage: `${label} saved! 📅\n**${d.title}** on ${formatDate(d.date)}${d.time ? ` at ${d.time}` : ""}${d.location ? ` · ${d.location}` : ""}.\n\nThe meeting invite has **not** been sent to recipients yet. Open Schedule when you’re ready to send it.`,
          data: apt[0],
        };
      }

      case "task": {
        const d = details as PATaskDetails;
        const task = await db.insert(tasksTable).values({
          userId,
          title: d.title,
          category: d.category ?? null,
          dueDate: d.dueDate ?? null,
          priority: d.priority ?? "medium",
          notes: d.notes ?? null,
          folder: d.folder ?? "Tasks",
          reminder: d.reminder ?? false,
          needsDocuments: d.needsDocuments ?? false,
        }).returning();
        return {
          success: true,
          paMessage: `Task added! ✅\n**${d.title}**${d.dueDate ? ` is due ${formatDate(d.dueDate)}` : ""}.\nYou can check it off or review it in your Tasks and Calendar views.`,
          data: task[0],
        };
      }

      case "note": {
        const d = details as PANoteDetails;
        const note = await db.insert(notesTable).values({
          userId,
          content: d.content,
          topic: d.topic ?? "General",
          folder: d.folder ?? "Notes",
          reminder: d.reminder ?? false,
          reminderDate: d.reminderDate ?? null,
        }).returning();
        return {
          success: true,
          paMessage: `Note organised! 📝\nSaved under **${d.topic ?? "General"}** in ${d.folder ?? "Notes"}${d.reminder ? " with a reminder." : "."}`,
          data: note[0],
        };
      }

      case "link": {
        const d = details as PALinkDetails;
        const link = await db.insert(savedLinksTable).values({
          userId,
          url: d.url,
          title: d.title ?? null,
          category: d.category ?? null,
          notes: d.notes ?? null,
        }).returning();
        return {
          success: true,
          paMessage: `Link saved! 🔗\n${d.title ? `**${d.title}**\n` : ""}${d.url}${d.category ? `\nCategory: ${d.category}` : ""}`,
          data: link[0],
        };
      }

      case "file_note": {
        const d = details as PAFileNoteDetails;
        // Save as a link record with the folder path as URL
        const note = await db.insert(savedLinksTable).values({
          userId,
          url: `file://${d.folder}/${d.filename}`,
          title: d.filename,
          category: `${d.mediaType} · ${d.folder}`,
          notes: d.notes ?? null,
        }).returning();
        return {
          success: true,
          paMessage: `File note saved! 📁\n**${d.filename}** → ${d.folder}\nType: ${d.mediaType}`,
          data: note[0],
        };
      }

      case "notify": {
        const d = details as PANotifyDetails;
        // Save as an appointment/reminder as a proxy for notification
        await db.insert(appointmentsTable).values({
          userId,
          title: `Notification to ${d.recipient}: ${d.subject}`,
          date: new Date().toISOString().slice(0, 10),
          notes: d.message,
          isReminder: true,
        });
        return {
          success: true,
          paMessage: `Notification sent to **${d.recipient}**! 📨\n*"${d.subject}"*\n${d.message}`,
        };
      }

      default:
        return { success: false, paMessage: "This action isn't supported yet." };
    }
  } catch (err) {
    console.error("[pa-assistant] Execute error:", err);
    return { success: false, paMessage: "Something went wrong while processing that. Please try again." };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-SG", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  } catch { return dateStr; }
}

function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

export async function getUserAppointments(userId: number) {
  return db.select().from(appointmentsTable)
    .where(eq(appointmentsTable.userId, userId))
    .orderBy(desc(appointmentsTable.date));
}

export async function getUserLinks(userId: number) {
  return db.select().from(savedLinksTable)
    .where(eq(savedLinksTable.userId, userId))
    .orderBy(desc(savedLinksTable.createdAt));
}

export async function getUserTasks(userId: number) {
  return db.select().from(tasksTable).where(eq(tasksTable.userId, userId)).orderBy(desc(tasksTable.createdAt));
}

export async function getUserNotes(userId: number) {
  return db.select().from(notesTable).where(eq(notesTable.userId, userId)).orderBy(desc(notesTable.createdAt));
}

export async function getUserFiles(userId: number) {
  return db.select().from(filesTable).where(eq(filesTable.userId, userId)).orderBy(desc(filesTable.createdAt));
}
