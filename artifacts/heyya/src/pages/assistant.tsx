import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";
import { useGetMe } from "@workspace/api-client-react";
import {
  CalendarDays, Check, CheckCircle2, Clock3, FileImage, FileText, FolderOpen, Link2, Loader2,
  MessageCircle, Paperclip, Plus, SendHorizontal, Sparkles, StickyNote, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkspaceView = "assistant" | "schedule" | "tasks" | "notes" | "files" | "calendar";
type IntentType = "leave" | "appointment" | "task" | "note" | "link" | "file_note" | "notify" | "chat" | "unclear";
type Priority = "low" | "medium" | "high";

interface PAResult { type: IntentType; requiresConfirmation: boolean; paMessage: string; confirmText?: string; confirmTitle?: string; details: Record<string, unknown>; }
interface ChatMessage { id: string; author: "user" | "assistant"; content: string; result?: PAResult; state?: "pending" | "confirmed" | "cancelled"; }
interface Appointment { id: number; title: string; date: string; time: string | null; location: string | null; notes: string | null; isReminder: boolean; inviteStatus: "not_sent" | "sent"; }
interface Task { id: number; title: string; category: string | null; dueDate: string | null; priority: Priority; notes: string | null; folder: string; needsDocuments: boolean; reminder: boolean; completed: boolean; }
interface Note { id: number; content: string; topic: string; folder: string; reminder: boolean; reminderDate: string | null; createdAt: string; }
interface SavedFile { id: number; originalName: string; mimeType: string; size: number; fileType: "image" | "video" | "document"; folder: string; createdAt: string; }
interface SavedLink { id: number; url: string; title: string | null; category: string | null; }
interface Leave { id: number; startDate: string; endDate: string; reason: string; type: string; status: string; }

const quickActions = [
  { icon: CalendarDays, label: "Schedule", action: "schedule" },
  { icon: CheckCircle2, label: "Task", action: "task" },
  { icon: StickyNote, label: "Notes", action: "note" },
  { icon: Upload, label: "Upload file(s)", action: "upload" },
  { icon: Clock3, label: "Apply for leave", action: "leave" },
] as const;

const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
const formatLongDate = (date: Date) => {
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  return `${day}${suffix} ${month} ${date.getFullYear()}, ${date.toLocaleDateString("en-GB", { weekday: "long" })}`;
};

export default function PersonalAssistantPage() {
  const { data: user } = useGetMe();
  const [activeView, setActiveView] = useState<WorkspaceView>("assistant");
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [files, setFiles] = useState<SavedFile[]>([]);
  const [links, setLinks] = useState<SavedLink[]>([]);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<"task" | "note" | "upload" | null>(null);
  const [taskSeed, setTaskSeed] = useState("");
  const [noteSeed, setNoteSeed] = useState("");
  const [now, setNow] = useState(new Date());
  const bottomRef = useRef<HTMLDivElement>(null);

  const greeting = useMemo(() => `Hi ${user?.name?.split(" ").slice(0, 2).join(" ") || "there"}! I’m Heyya, your personal assistant. I can organise tasks, notes, files, meetings, leave, and school work. What would you like to do?`, [user?.name]);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [apt, task, note, file, link, calendar] = await Promise.all([
        fetch("/api/pa/appointments", { credentials: "include" }),
        fetch("/api/pa/tasks", { credentials: "include" }),
        fetch("/api/pa/notes", { credentials: "include" }),
        fetch("/api/pa/files", { credentials: "include" }),
        fetch("/api/pa/links", { credentials: "include" }),
        fetch("/api/pa/calendar", { credentials: "include" }),
      ]);
      if (apt.ok) setAppointments(await apt.json());
      if (task.ok) setTasks(await task.json());
      if (note.ok) setNotes(await note.json());
      if (file.ok) setFiles(await file.json());
      if (link.ok) setLinks(await link.json());
      if (calendar.ok) setLeave((await calendar.json()).leave ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadWorkspace(); }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (activeView === "assistant") bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isThinking, activeView]);

  const pushAssistant = (content: string, result?: PAResult) => setMessages((current) => [...current, { id: `assistant-${Date.now()}`, author: "assistant", content, result, state: result?.requiresConfirmation ? "pending" : undefined }]);

  const sendMessage = async (text: string) => {
    const message = text.trim();
    if (!message || isThinking) return;
    setDraft("");
    setMessages((current) => [...current, { id: `user-${Date.now()}`, author: "user", content: message }]);
    setIsThinking(true);
    try {
      const response = await fetch("/api/pa/chat", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      const result = await response.json() as PAResult;
      pushAssistant(result.paMessage, result);
    } catch { pushAssistant("I couldn’t process that just now. Please try again in a moment."); }
    finally { setIsThinking(false); }
  };

  const resolveConfirmation = async (messageId: string, confirmed: boolean) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message?.result) return;
    if (!confirmed) { setMessages((current) => current.map((item) => item.id === messageId ? { ...item, state: "cancelled" } : item)); return; }
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, state: "confirmed" } : item));
    setIsThinking(true);
    try {
      const response = await fetch("/api/pa/execute", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: message.result.type, details: message.result.details }) });
      const execution = await response.json();
      pushAssistant(execution.paMessage ?? "Done!");
      await loadWorkspace();
    } catch { pushAssistant("I couldn’t complete that action. Please try it again."); }
    finally { setIsThinking(false); }
  };

  const openTask = (seed = "") => { setTaskSeed(seed); setDialog("task"); };
  const openNote = (seed = "") => { setNoteSeed(seed); setDialog("note"); };
  const handleQuick = (action: typeof quickActions[number]["action"]) => {
    if (action === "task") return openTask();
    if (action === "note") return openNote();
    if (action === "upload") return setDialog("upload");
    const prompts: Record<string, string> = {
      schedule: "Schedule a meeting: ",
      leave: "I need to apply for leave because ",
    };
    setDraft(prompts[action]);
  };

  const reviewGuidedAction = (type: "task" | "note", details: Record<string, unknown>, confirmText: string, confirmTitle: string) => {
    setDialog(null); setActiveView("assistant");
    pushAssistant("I’ve put this together for you. Please review it before I save it.", { type, details, requiresConfirmation: true, paMessage: "", confirmText, confirmTitle });
  };

  const toggleTask = async (task: Task) => {
    const response = await fetch(`/api/pa/tasks/${task.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !task.completed }) });
    if (response.ok) setTasks((items) => items.map((item) => item.id === task.id ? { ...item, completed: !item.completed } : item));
  };

  const sendInvite = async (id: number) => {
    const response = await fetch(`/api/pa/appointments/${id}/invite`, { method: "PATCH", credentials: "include" });
    if (response.ok) { setAppointments((items) => items.map((item) => item.id === id ? { ...item, inviteStatus: "sent" } : item)); pushAssistant("The invite is marked as sent in Heyya. Connect a calendar or email provider before sending external invitations."); }
  };

  const navItems: { id: WorkspaceView; label: string; icon: typeof Sparkles }[] = [
    { id: "assistant", label: "Assistant", icon: Sparkles }, { id: "schedule", label: "Schedule", icon: CalendarDays },
    { id: "tasks", label: "Tasks", icon: CheckCircle2 }, { id: "notes", label: "Notes", icon: StickyNote },
    { id: "files", label: "Files", icon: FolderOpen }, { id: "calendar", label: "Calendar", icon: CalendarDays },
  ];

  return (
    <div className="flex h-full min-h-0 bg-[#f6f8fb]">
      <aside className="hidden xl:flex w-56 flex-col border-r bg-white p-3">
        <p className="px-3 pt-3 pb-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Personal workspace</p>
        <nav className="space-y-1">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveView(id)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", activeView === id ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50")}><Icon className="h-4 w-4" />{label}</button>)}</nav>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 p-4 text-white"><Sparkles className="h-5 w-5" /><p className="mt-4 text-sm font-semibold">Your day, organised.</p><p className="mt-1 text-xs leading-relaxed text-white/80">Heyya always asks before saving a task, note, or plan.</p></div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-white px-5 sm:px-7">
          <div><p className="text-xs font-medium text-slate-400">Heyya Personal Assistant</p><h1 className="text-base font-semibold text-slate-900">{activeView === "assistant" ? "Your workspace" : navItems.find((item) => item.id === activeView)?.label}</h1></div>
          <div className="hidden items-center gap-3 rounded-full bg-slate-50 px-3 py-1.5 text-right sm:flex"><div><p className="text-[11px] text-slate-500">{formatLongDate(now)}</p><p className="font-mono text-xs font-semibold text-slate-700">{now.toLocaleTimeString("en-GB")}</p></div><span className="h-2 w-2 rounded-full bg-emerald-500" /></div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeView === "assistant" && <AssistantView greeting={greeting} messages={messages} isThinking={isThinking} draft={draft} setDraft={setDraft} onSend={sendMessage} onConfirm={resolveConfirmation} onTask={openTask} onNote={openNote} onQuick={handleQuick} bottomRef={bottomRef} />}
          {activeView === "schedule" && <ScheduleView appointments={appointments} loading={loading} onNew={() => setActiveView("assistant")} onInvite={sendInvite} />}
          {activeView === "tasks" && <TasksView tasks={tasks} loading={loading} onNew={() => openTask()} onToggle={toggleTask} />}
          {activeView === "notes" && <NotesView notes={notes} loading={loading} onNew={() => openNote()} />}
          {activeView === "files" && <FilesView files={files} links={links} loading={loading} onNew={() => setDialog("upload")} />}
          {activeView === "calendar" && <CalendarView appointments={appointments} tasks={tasks} leave={leave} />}
        </div>
      </main>
      {dialog === "task" && <TaskDialog initialTitle={taskSeed} isTeacher={user?.role === "teacher"} onClose={() => setDialog(null)} onReview={(details, text) => reviewGuidedAction("task", details, text, "Create task")} />}
      {dialog === "note" && <NoteDialog initialContent={noteSeed} onClose={() => setDialog(null)} onReview={(details, text) => reviewGuidedAction("note", details, text, "Save note")} />}
      {dialog === "upload" && <UploadDialog onClose={() => setDialog(null)} onComplete={async (message) => { setDialog(null); pushAssistant(message); await loadWorkspace(); }} />}
    </div>
  );
}

function AssistantView({ greeting, messages, isThinking, draft, setDraft, onSend, onConfirm, onTask, onNote, onQuick, bottomRef }: { greeting: string; messages: ChatMessage[]; isThinking: boolean; draft: string; setDraft: (value: string) => void; onSend: (text: string) => void; onConfirm: (id: string, value: boolean) => void; onTask: (seed?: string) => void; onNote: (seed?: string) => void; onQuick: (action: typeof quickActions[number]["action"]) => void; bottomRef: RefObject<HTMLDivElement | null>; }) {
  return <section className="flex h-full flex-col"><div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"><div className="mx-auto max-w-3xl space-y-5"><AssistantBubble content={greeting} />{messages.map((message) => message.author === "user" ? <UserBubble key={message.id} content={message.content} /> : <AssistantBubble key={message.id} content={message.content} result={message.result} state={message.state} onConfirm={() => onConfirm(message.id, true)} onCancel={() => onConfirm(message.id, false)} onTask={() => onTask(String(message.result?.details.title ?? ""))} onNote={() => onNote(String(message.result?.details.content ?? ""))} />)}{isThinking && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-sky-600" /> Heyya is organising that…</div>}<div ref={bottomRef} /></div></div><div className="border-t bg-white px-4 py-4 sm:px-8"><div className="mx-auto max-w-3xl"><div className="mb-3 flex gap-2 overflow-x-auto pb-1">{quickActions.map(({ icon: Icon, label, action }) => <button key={label} onClick={() => onQuick(action)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"><Icon className="h-3.5 w-3.5" />{label}</button>)}</div><div className="flex items-end gap-2 rounded-2xl border bg-slate-50 p-2 focus-within:border-sky-300 focus-within:ring-4 focus-within:ring-sky-100"><Paperclip className="mb-2 ml-1 h-4 w-4 text-slate-400" /><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onSend(draft); } }} rows={1} placeholder="Tell Heyya what you need…" className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" /><Button size="icon" className="h-9 w-9 rounded-xl" onClick={() => onSend(draft)} disabled={!draft.trim() || isThinking}><SendHorizontal className="h-4 w-4" /></Button></div><p className="mt-2 text-center text-[11px] text-slate-400">Heyya always asks for confirmation before making changes.</p></div></div></section>;
}

function AssistantBubble({ content, result, state, onConfirm, onCancel, onTask, onNote }: { content: string; result?: PAResult; state?: ChatMessage["state"]; onConfirm?: () => void; onCancel?: () => void; onTask?: () => void; onNote?: () => void; }) {
  return <div className="flex max-w-2xl gap-3"><div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white"><Sparkles className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm whitespace-pre-line">{content}</div>{result && !result.requiresConfirmation && (result.type === "task" || result.type === "note") && <Button className="mt-3" size="sm" variant="outline" onClick={result.type === "task" ? onTask : onNote}><Plus className="mr-1 h-3.5 w-3.5" />Add details</Button>}{result?.requiresConfirmation && <div className={cn("mt-3 overflow-hidden rounded-2xl border bg-white shadow-sm", state === "confirmed" ? "border-emerald-200" : state === "cancelled" ? "border-slate-200 opacity-70" : "border-sky-200")}><div className="flex items-center gap-2 border-b bg-sky-50 px-4 py-2.5"><Sparkles className="h-4 w-4 text-sky-600" /><span className="text-sm font-semibold text-slate-800">{state === "confirmed" ? "Confirmed" : state === "cancelled" ? "Cancelled" : result.confirmTitle ?? "Please confirm"}</span></div><div className="px-4 py-3"><p className="text-sm leading-relaxed text-slate-600">{result.confirmText}</p>{state === "pending" && <div className="mt-4 flex gap-2"><Button size="sm" onClick={onConfirm}><Check className="mr-1 h-3.5 w-3.5" />Confirm</Button><Button size="sm" variant="outline" onClick={onCancel}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button></div>}</div></div>}</div></div>;
}
function UserBubble({ content }: { content: string }) { return <div className="flex justify-end"><div className="max-w-2xl rounded-2xl rounded-tr-sm bg-sky-600 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">{content}</div></div>; }

function Page({ title, text, action, onAction, children }: { title: string; text: string; action?: string; onAction?: () => void; children: ReactNode }) { return <div className="h-full overflow-y-auto p-5 sm:p-8"><div className="mx-auto max-w-5xl"><div className="mb-6 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p></div>{action && onAction && <Button onClick={onAction}><Plus className="mr-1.5 h-4 w-4" />{action}</Button>}</div>{children}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center text-sm text-slate-500">{text}</div>; }
function LoadingRows() { return <div className="space-y-3">{[1, 2, 3].map((item) => <div className="h-16 animate-pulse rounded-2xl border bg-white" key={item} />)}</div>; }

function ScheduleView({ appointments, loading, onNew, onInvite }: { appointments: Appointment[]; loading: boolean; onNew: () => void; onInvite: (id: number) => void; }) { return <Page title="Your schedule" text="Appointments, meetings, and reminders organised by Heyya." action="Ask Heyya" onAction={onNew}>{loading ? <LoadingRows /> : appointments.length === 0 ? <Empty text="Nothing scheduled yet. Ask Heyya to plan a meeting or reminder." /> : <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">{appointments.map((item) => <div className="flex flex-wrap items-center gap-4 border-b px-4 py-4 last:border-0" key={item.id}><div className="w-12 rounded-xl bg-sky-50 py-1.5 text-center text-sky-700"><p className="text-[10px] font-semibold uppercase">{new Date(`${item.date}T12:00:00`).toLocaleDateString("en-GB", { month: "short" })}</p><p className="text-lg font-bold leading-none">{new Date(`${item.date}T12:00:00`).getDate()}</p></div><div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{item.title}</p><p className="mt-0.5 text-xs text-slate-500">{formatDate(item.date)}{item.time ? ` · ${item.time}` : ""}{item.location ? ` · ${item.location}` : ""}</p></div>{!item.isReminder && (item.inviteStatus === "not_sent" ? <Button size="sm" variant="outline" onClick={() => onInvite(item.id)}>Send invite now?</Button> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Invite sent</span>)}</div>)}</div>}</Page>; }

function TasksView({ tasks, loading, onNew, onToggle }: { tasks: Task[]; loading: boolean; onNew: () => void; onToggle: (task: Task) => void; }) { return <Page title="Tasks & assignments" text="Keep personal work, teaching tasks, and deadlines in one place." action="New task" onAction={onNew}>{loading ? <LoadingRows /> : tasks.length === 0 ? <Empty text="No tasks yet. Let Heyya turn your next assignment into a plan." /> : <div className="space-y-2">{tasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm"><button onClick={() => onToggle(task)} className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", task.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent")} aria-label={`Mark ${task.title} ${task.completed ? "incomplete" : "complete"}`}><Check className="h-4 w-4" /></button><div className="min-w-0 flex-1"><p className={cn("font-medium text-slate-900", task.completed && "text-slate-400 line-through")}>{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.category ?? "General"} · {task.folder}{task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ""}{task.needsDocuments ? " · Documents needed" : ""}</p></div><span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold capitalize", task.priority === "high" ? "bg-rose-50 text-rose-700" : task.priority === "low" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700")}>{task.priority}</span></div>)}</div>}</Page>; }
function NotesView({ notes, loading, onNew }: { notes: Note[]; loading: boolean; onNew: () => void; }) { return <Page title="Notes" text="Capture rough thoughts, then keep them organised by topic and folder." action="New note" onAction={onNew}>{loading ? <LoadingRows /> : notes.length === 0 ? <Empty text="No notes yet. Use Heyya to turn a rough note into an organised record." /> : <div className="grid gap-3 md:grid-cols-2">{notes.map((note) => <article className="rounded-2xl border bg-white p-4 shadow-sm" key={note.id}><div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700">{note.topic}</span><span className="text-[11px] text-slate-400">{note.folder}</span></div><p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{note.content}</p>{note.reminder && <p className="mt-3 text-xs font-medium text-amber-700">Reminder{note.reminderDate ? ` · ${formatDate(note.reminderDate)}` : ""}</p>}</article>)}</div>}</Page>; }
function FilesView({ files, links, loading, onNew }: { files: SavedFile[]; links: SavedLink[]; loading: boolean; onNew: () => void; }) { return <Page title="Files & library" text="Private uploads and saved links, arranged by folder and category." action="Upload file(s)" onAction={onNew}>{loading ? <LoadingRows /> : <div className="space-y-6"><section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><FolderOpen className="h-4 w-4 text-sky-600" />Private files ({files.length})</h3>{files.length === 0 ? <Empty text="No uploaded files yet. Upload images, Word documents, PDFs, or videos." /> : <div className="overflow-hidden rounded-2xl border bg-white">{files.map((file) => <div className="flex items-center gap-3 border-b px-4 py-3 last:border-0" key={file.id}><FileText className="h-5 w-5 text-sky-600" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{file.originalName}</p><p className="text-xs text-slate-500">{file.folder} · {(file.size / 1024 / 1024).toFixed(1)} MB</p></div><Button size="sm" variant="outline" onClick={() => window.open(`/api/pa/files/${file.id}/download`, "_blank")}>Open</Button></div>)}</div>}</section><section><h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Link2 className="h-4 w-4 text-sky-600" />Saved links ({links.length})</h3>{links.length === 0 ? <Empty text="No saved links yet." /> : <div className="overflow-hidden rounded-2xl border bg-white">{links.map((link) => <a className="flex items-center gap-3 border-b px-4 py-3 text-sm hover:bg-slate-50 last:border-0" key={link.id} href={link.url} target="_blank" rel="noreferrer"><Link2 className="h-4 w-4 text-slate-400" /><span className="min-w-0 flex-1 truncate">{link.title || link.url}</span><span className="text-xs text-sky-600">{link.category}</span></a>)}</div>}</section></div>}</Page>; }

function CalendarView({ appointments, tasks, leave }: { appointments: Appointment[]; tasks: Task[]; leave: Leave[]; }) { const now = new Date(); const year = now.getFullYear(); const month = now.getMonth(); const days = new Date(year, month + 1, 0).getDate(); const offset = new Date(year, month, 1).getDay(); const events: Record<string, { kind: string; text: string; done?: boolean }[]> = {}; const add = (date: string | null, event: { kind: string; text: string; done?: boolean }) => { if (date) (events[date] ??= []).push(event); }; appointments.forEach((item) => add(item.date, { kind: "appointment", text: item.title })); tasks.forEach((item) => add(item.dueDate, { kind: "task", text: item.title, done: item.completed })); leave.forEach((item) => add(item.startDate, { kind: "leave", text: `${item.type} leave (${item.status})` })); return <Page title="Calendar" text="Confirmed schedules, deadlines, and leave at a glance."><div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="grid grid-cols-7 border-b bg-slate-50">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div className="px-2 py-3 text-center text-[10px] font-semibold uppercase text-slate-400" key={day}>{day}</div>)}</div><div className="grid grid-cols-7">{Array.from({ length: offset + days }, (_, index) => { const day = index - offset + 1; const valid = day > 0; const date = valid ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : ""; return <div className="min-h-24 border-b border-r p-2 last:border-r-0" key={index}>{valid && <><p className={cn("mb-1 text-xs font-medium", day === now.getDate() ? "text-sky-700" : "text-slate-500")}>{day}</p>{(events[date] ?? []).slice(0, 3).map((event, eventIndex) => <p key={eventIndex} className={cn("mb-1 truncate rounded px-1 py-0.5 text-[9px] font-medium", event.kind === "appointment" ? "bg-sky-50 text-sky-700" : event.kind === "leave" ? "bg-rose-50 text-rose-700" : event.done ? "bg-slate-100 text-slate-400 line-through" : "bg-amber-50 text-amber-700")}>{event.text}</p>)}</>}</div>; })}</div></div><p className="mt-3 text-xs text-slate-400">Blue: schedule · Amber: task · Rose: leave</p></Page>; }

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 p-4 sm:items-center"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-slate-700"><span className="mb-1.5 block">{label}</span>{children}</label>; }
const inputStyle = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
function TaskDialog({ initialTitle, isTeacher, onClose, onReview }: { initialTitle: string; isTeacher: boolean; onClose: () => void; onReview: (details: Record<string, unknown>, text: string) => void; }) { const [title, setTitle] = useState(initialTitle); const [category, setCategory] = useState(""); const [dueDate, setDueDate] = useState(""); const [priority, setPriority] = useState<Priority>("medium"); const [folder, setFolder] = useState("Tasks"); const [reminder, setReminder] = useState(false); const [needsDocuments, setNeedsDocuments] = useState(false); return <Modal title="Heyya needs a few task details" onClose={onClose}><p className="mb-4 text-sm text-slate-500">Tell Heyya what this is, where it belongs, when it is due, and how to support you.</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Title"><input className={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mark history essays" /></Field><Field label={isTeacher ? "Subject / class" : "Category"}><input className={inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} placeholder={isTeacher ? "e.g. Grade 10 History" : "e.g. Personal"} /></Field><Field label="Due date"><input className={inputStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field><Field label="Priority"><select className={inputStyle} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field><Field label="Store in"><input className={inputStyle} value={folder} onChange={(e) => setFolder(e.target.value)} /></Field></div><div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> Remind me about this</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={needsDocuments} onChange={(e) => setNeedsDocuments(e.target.checked)} /> {isTeacher ? "Will students need supporting documents?" : "Attach supporting documents later"}</label></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!title.trim()} onClick={() => onReview({ title, category: category || null, dueDate: dueDate || null, priority, folder, reminder, needsDocuments }, `Create “${title}”${category ? ` in ${category}` : ""}${dueDate ? ` due ${formatDate(dueDate)}` : ""} with ${priority} priority.`)}>Review task</Button></div></Modal>; }
function NoteDialog({ initialContent, onClose, onReview }: { initialContent: string; onClose: () => void; onReview: (details: Record<string, unknown>, text: string) => void; }) { const [content, setContent] = useState(initialContent); const [topic, setTopic] = useState(""); const [folder, setFolder] = useState("Notes"); const [reminder, setReminder] = useState(false); const [reminderDate, setReminderDate] = useState(""); return <Modal title="Organise a note with Heyya" onClose={onClose}><p className="mb-4 text-sm text-slate-500">What is this note about, where should it go, and do you want a reminder?</p><div className="space-y-3"><Field label="Rough note"><textarea className={inputStyle} rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write anything — Heyya will keep it organised." /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Topic"><input className={inputStyle} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Parent meeting" /></Field><Field label="Store in"><input className={inputStyle} value={folder} onChange={(e) => setFolder(e.target.value)} /></Field></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reminder} onChange={(e) => setReminder(e.target.checked)} /> Add a reminder</label>{reminder && <Field label="Reminder date"><input className={inputStyle} type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} /></Field>}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!content.trim()} onClick={() => onReview({ content, topic: topic || "General", folder, reminder, reminderDate: reminderDate || null }, `Save this note under ${topic || "General"} in ${folder}${reminder ? " with a reminder" : ""}.`)}>Review note</Button></div></Modal>; }
function UploadDialog({ onClose, onComplete }: { onClose: () => void; onComplete: (message: string) => void; }) { const [selected, setSelected] = useState<File[]>([]); const [folder, setFolder] = useState("Uploads"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const selectFiles = (event: ChangeEvent<HTMLInputElement>) => setSelected(Array.from(event.target.files ?? [])); const upload = async () => { if (!selected.length) return; setBusy(true); setError(""); try { for (const file of selected) { const request = await fetch("/api/pa/uploads/request", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type, folder }) }); const signed = await request.json(); if (!request.ok) throw new Error(signed.error ?? "Could not prepare upload"); const uploaded = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }); if (!uploaded.ok) throw new Error(`Could not upload ${file.name}`); const save = await fetch("/api/pa/files", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectPath: signed.objectPath, originalName: file.name, mimeType: file.type, size: file.size, folder }) }); if (!save.ok) throw new Error(`Could not save ${file.name}`); } onComplete(`${selected.length} private file${selected.length === 1 ? "" : "s"} uploaded to ${folder}.`); } catch (err) { setError(err instanceof Error ? err.message : "Upload failed"); } finally { setBusy(false); } }; return <Modal title="Upload private files" onClose={onClose}><p className="mb-4 text-sm text-slate-500">Images, Word documents, PDFs, and common video formats are supported (up to 100 MB each). Files stay private to your Heyya account.</p><div className="space-y-3"><Field label="Folder / category"><input className={inputStyle} value={folder} onChange={(e) => setFolder(e.target.value)} /></Field><Field label="Choose file(s)"><input className="block w-full text-sm" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/webm,video/quicktime" onChange={selectFiles} /></Field>{selected.length > 0 && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{selected.map((file) => file.name).join(", ")}</p>}{error && <p className="text-sm text-rose-600">{error}</p>}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!selected.length || busy} onClick={upload}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{busy ? "Uploading…" : "Upload privately"}</Button></div></Modal>; }