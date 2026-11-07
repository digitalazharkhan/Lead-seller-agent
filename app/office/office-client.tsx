"use client";

import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Command,
  Download,
  Globe,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
} from "react";
import styles from "./office.module.css";

type TaskType = "discover" | "emails" | "score" | "pitch" | "import" | "send";
type TaskStatus =
  | "queued"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "timed_out"
  | "interrupted";
type ConnectionState = "connecting" | "connected" | "reconnecting";

type OfficeTask = {
  id: string;
  task: TaskType;
  role: string;
  status: TaskStatus;
  lead_name: string | null;
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  error: string | null;
  result?: Record<string, unknown> | null;
};

type OfficeEvent = {
  id: number;
  task_id: string;
  type: string;
  message: string;
  data: Record<string, unknown>;
  created_at: string;
};

type ProspectStatus = "new" | "contacted" | "replied" | "opted-out" | "client";

type Prospect = {
  id: number;
  name: string;
  category: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  hasWebsite: boolean | null;
  score: number;
  status: ProspectStatus;
  reviews: number;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProspectActivity = {
  id: number;
  prospectId: number;
  eventType: "created" | "status_changed" | "imported";
  fromStatus: ProspectStatus | null;
  toStatus: ProspectStatus | null;
  createdAt: string;
};

type PitchDraft = {
  id: number | null;
  lead_name: string;
  email: string;
  subject: string;
  body: string;
  source_task_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  saved: boolean;
};

type LeadStatus = "new" | "ready" | "contacted" | "opted-out";

type Lead = {
  name: string;
  email: string;
  all_emails: string[];
  phone: string;
  website: string;
  address: string;
  score: number | null;
  status: LeadStatus;
  sent_at: string;
};

type Employee = {
  task: TaskType;
  name: string;
  role: string;
};

const EMPLOYEES: Employee[] = [
  { task: "discover", name: "Ali", role: "Discover Agent" },
  { task: "emails", name: "Ayesha", role: "Email Hunter Agent" },
  { task: "score", name: "Hassan", role: "Scoring Agent" },
  { task: "pitch", name: "Sara", role: "Pitch Writer Agent" },
  { task: "import", name: "Usman", role: "Importer Agent" },
  { task: "send", name: "Zainab", role: "Sender Agent" },
];

type StaffId = "azhar" | "khan" | "ali" | "ayesha" | "hassan" | "sara" | "usman" | "zainab";
type HairStyle = "side-part" | "curls" | "long" | "short" | "bun" | "hijab" | "fade" | "waves";

type OfficeStaff = {
  id: StaffId;
  name: string;
  title: string;
  task: TaskType | null;
  responsibilities: string;
  skin: string;
  hair: string;
  outfit: string;
  accent: string;
  hairStyle: HairStyle;
  facialHair?: boolean;
};

type FloorMode = "desks" | "lounge";
type FloorCue = {
  kind: "recall" | "success";
  message: string;
  taskId: string;
  staffId?: StaffId;
  sequence: number;
};
type StaffStation = { x: number; y: number; width: number; leadership?: boolean };

const OFFICE_STAFF: OfficeStaff[] = [
  {
    id: "azhar",
    name: "Azhar",
    title: "Boss · Founder",
    task: null,
    responsibilities: "Sets business priorities and reviews the Command Center’s overall work.",
    skin: "#bd8060",
    hair: "#34251f",
    outfit: "#243d59",
    accent: "#d8b27d",
    hairStyle: "side-part",
    facialHair: true,
  },
  {
    id: "khan",
    name: "Khan",
    title: "Senior AI Operations Manager",
    task: null,
    responsibilities: "Coordinates approved work, monitors real execution status, and reports task results to Azhar.",
    skin: "#a96f51",
    hair: "#241d1c",
    outfit: "#355f59",
    accent: "#8be2bd",
    hairStyle: "curls",
  },
  {
    id: "ali",
    name: "Ali",
    title: "Discover Agent",
    task: "discover",
    responsibilities: "Runs approved lead discovery and brings verified results back to the team.",
    skin: "#c58a68",
    hair: "#30241f",
    outfit: "#52775f",
    accent: "#b5d3a7",
    hairStyle: "short",
  },
  {
    id: "ayesha",
    name: "Ayesha",
    title: "Email Hunter Agent",
    task: "emails",
    responsibilities: "Finds publicly listed business contact emails and records their source.",
    skin: "#e1b18f",
    hair: "#3d2925",
    outfit: "#bd756b",
    accent: "#f0c4ae",
    hairStyle: "long",
  },
  {
    id: "hassan",
    name: "Hassan",
    title: "Scoring Agent",
    task: "score",
    responsibilities: "Scores leads using the existing transparent scoring criteria.",
    skin: "#9b684d",
    hair: "#242323",
    outfit: "#647995",
    accent: "#c5d1e0",
    hairStyle: "fade",
    facialHair: true,
  },
  {
    id: "sara",
    name: "Sara",
    title: "Pitch Writer Agent",
    task: "pitch",
    responsibilities: "Creates personalized pitch drafts that can be reviewed and edited before use.",
    skin: "#d29a78",
    hair: "#5b352d",
    outfit: "#76648f",
    accent: "#d3b9eb",
    hairStyle: "waves",
  },
  {
    id: "usman",
    name: "Usman",
    title: "Importer Agent",
    task: "import",
    responsibilities: "Imports approved lead records into the existing local database.",
    skin: "#b98160",
    hair: "#33251f",
    outfit: "#59798b",
    accent: "#b5d8e6",
    hairStyle: "side-part",
  },
  {
    id: "zainab",
    name: "Zainab",
    title: "Sender Agent · Dry-run only",
    task: "send",
    responsibilities: "Previews the sender workflow in dry-run mode only; this workstation never sends live email.",
    skin: "#a66f52",
    hair: "#342825",
    outfit: "#547d78",
    accent: "#aee0d6",
    hairStyle: "hijab",
  },
];

const STAFF_STATIONS: Record<StaffId, StaffStation> = {
  azhar: { x: 42, y: 800, width: 390, leadership: true },
  khan: { x: 470, y: 70, width: 560, leadership: true },
  ali: { x: 1110, y: 200, width: 440 },
  ayesha: { x: 1110, y: 470, width: 440 },
  hassan: { x: 1110, y: 740, width: 440 },
  sara: { x: 42, y: 210, width: 390 },
  usman: { x: 42, y: 480, width: 390 },
  zainab: { x: 470, y: 800, width: 390 },
};

const LOUNGE_POSITIONS: Partial<Record<StaffId, { x: number; y: number }>> = {
  ali: { x: 570, y: 485 },
  ayesha: { x: 720, y: 485 },
  hassan: { x: 870, y: 485 },
  sara: { x: 570, y: 625 },
  usman: { x: 720, y: 625 },
  zainab: { x: 870, y: 625 },
};

const TASK_LABELS: Record<TaskType, string> = {
  discover: "Discover leads",
  emails: "Find contact emails",
  score: "Score leads",
  pitch: "Write a pitch",
  import: "Import leads to SQLite",
  send: "Review sender dry-run",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: "Queued",
  assigned: "Assigned",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  timed_out: "Timed out",
  interrupted: "Interrupted",
};

const STATUS_CLASSES: Record<TaskStatus, string> = {
  queued: styles.statusQueued,
  assigned: styles.statusAssigned,
  running: styles.statusRunning,
  completed: styles.statusCompleted,
  failed: styles.statusFailed,
  timed_out: styles.statusTimedOut,
  interrupted: styles.statusInterrupted,
};

const TERMINAL_STATUSES = new Set<TaskStatus>([
  "completed",
  "failed",
  "timed_out",
  "interrupted",
]);

const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  "opted-out": "Opted out",
  client: "Client",
};

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  ready: "Ready",
  contacted: "Contacted",
  "opted-out": "Opted out",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isProspectStatus(value: unknown): value is ProspectStatus {
  return value === "new" || value === "contacted" || value === "replied" ||
    value === "opted-out" || value === "client";
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return value === "new" || value === "ready" || value === "contacted" ||
    value === "opted-out";
}

function isProspect(value: unknown): value is Prospect {
  return isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    typeof value.city === "string" &&
    typeof value.phone === "string" &&
    typeof value.email === "string" &&
    typeof value.website === "string" &&
    (value.hasWebsite === null || typeof value.hasWebsite === "boolean") &&
    typeof value.score === "number" &&
    isProspectStatus(value.status) &&
    typeof value.reviews === "number" &&
    typeof value.isDemo === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string";
}

function isLead(value: unknown): value is Lead {
  return isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    Array.isArray(value.all_emails) &&
    value.all_emails.every((email) => typeof email === "string") &&
    typeof value.phone === "string" &&
    typeof value.website === "string" &&
    typeof value.address === "string" &&
    (value.score === null || typeof value.score === "number") &&
    isLeadStatus(value.status) &&
    typeof value.sent_at === "string";
}

function parseProspectList(payload: unknown): Prospect[] {
  if (!Array.isArray(payload) || !payload.every(isProspect)) {
    throw new Error("The prospects API returned an invalid record list.");
  }
  return payload;
}

function isProspectActivity(value: unknown): value is ProspectActivity {
  return isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.prospectId === "number" &&
    (value.eventType === "created" || value.eventType === "status_changed" ||
      value.eventType === "imported") &&
    (value.fromStatus === null || isProspectStatus(value.fromStatus)) &&
    (value.toStatus === null || isProspectStatus(value.toStatus)) &&
    typeof value.createdAt === "string";
}

function parseProspectActivity(payload: unknown): ProspectActivity[] {
  if (!isRecord(payload) || !Array.isArray(payload.activities) ||
      !payload.activities.every(isProspectActivity)) {
    throw new Error("The prospects API returned invalid activity history.");
  }
  return payload.activities;
}

function isPitchDraft(value: unknown): value is PitchDraft {
  return isRecord(value) &&
    (value.id === null || typeof value.id === "number") &&
    typeof value.lead_name === "string" &&
    typeof value.email === "string" &&
    typeof value.subject === "string" &&
    typeof value.body === "string" &&
    (value.source_task_id === null || typeof value.source_task_id === "string") &&
    (value.created_at === null || typeof value.created_at === "string") &&
    (value.updated_at === null || typeof value.updated_at === "string") &&
    typeof value.saved === "boolean";
}

function parsePitchDraft(payload: unknown): PitchDraft | null {
  if (!isRecord(payload) || !(payload.draft === null || isPitchDraft(payload.draft))) {
    throw new Error("The office API returned an invalid pitch draft.");
  }
  return payload.draft;
}

function parseLeadList(payload: unknown): Lead[] {
  if (!isRecord(payload) || !Array.isArray(payload.leads) || !payload.leads.every(isLead)) {
    throw new Error("The leads API returned an invalid record list.");
  }
  return payload.leads;
}

function isTaskType(value: unknown): value is TaskType {
  return value === "discover" || value === "emails" || value === "score" ||
    value === "pitch" || value === "import" || value === "send";
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return value === "queued" || value === "assigned" || value === "running" ||
    value === "completed" || value === "failed" || value === "timed_out" ||
    value === "interrupted";
}

function isOfficeTask(value: unknown): value is OfficeTask {
  return isRecord(value) &&
    typeof value.id === "string" &&
    isTaskType(value.task) &&
    typeof value.role === "string" &&
    isTaskStatus(value.status) &&
    (value.lead_name === null || typeof value.lead_name === "string") &&
    typeof value.created_at === "string" &&
    (value.assigned_at === null || typeof value.assigned_at === "string") &&
    (value.started_at === null || typeof value.started_at === "string") &&
    (value.completed_at === null || typeof value.completed_at === "string") &&
    (value.exit_code === null || typeof value.exit_code === "number") &&
    (value.error === null || typeof value.error === "string") &&
    (value.result === undefined || value.result === null || isRecord(value.result));
}

function isOfficeEvent(value: unknown): value is OfficeEvent {
  return isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.task_id === "string" &&
    typeof value.type === "string" &&
    typeof value.message === "string" &&
    isRecord(value.data) &&
    typeof value.created_at === "string";
}

function parseTaskList(payload: unknown): OfficeTask[] {
  if (!isRecord(payload) || !Array.isArray(payload.tasks)) {
    throw new Error("The office API returned invalid task history.");
  }
  const taskValues: unknown[] = payload.tasks;
  if (!taskValues.every(isOfficeTask)) {
    throw new Error("The office API returned an invalid task record.");
  }
  return taskValues;
}

function parseEventList(payload: unknown): OfficeEvent[] {
  if (!isRecord(payload) || !Array.isArray(payload.events)) {
    throw new Error("The office API returned invalid task events.");
  }
  const eventValues: unknown[] = payload.events;
  if (!eventValues.every(isOfficeEvent)) {
    throw new Error("The office API returned an invalid task event.");
  }
  return eventValues;
}

function parseTaskDetails(payload: unknown): OfficeTask {
  if (!isRecord(payload) || !isOfficeTask(payload.task)) {
    throw new Error("The office API returned invalid task details.");
  }
  return payload.task;
}

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`The office API returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === "string"
      ? payload.error
      : `Office request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload;
}

function mergeEvents(current: OfficeEvent[], incoming: OfficeEvent[]): OfficeEvent[] {
  const eventsById = new Map<number, OfficeEvent>();
  for (const event of [...current, ...incoming]) eventsById.set(event.id, event);
  return Array.from(eventsById.values()).sort((a, b) => b.id - a.id).slice(0, 40);
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function downloadRecords(
  filename: string,
  content: string,
  type: "text/csv;charset=utf-8" | "application/json;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function displayTaskName(task: TaskType): string {
  return EMPLOYEES.find((employee) => employee.task === task)?.name ?? task;
}

function prospectActivityLabel(activity: ProspectActivity): string {
  if (activity.eventType === "created") return "Prospect created";
  if (activity.eventType === "imported") return "Imported from lead files";
  const previous = activity.fromStatus
    ? PROSPECT_STATUS_LABELS[activity.fromStatus]
    : "Unknown";
  const next = activity.toStatus
    ? PROSPECT_STATUS_LABELS[activity.toStatus]
    : "Unknown";
  return `Status changed: ${previous} → ${next}`;
}

function stateIcon(status: TaskStatus) {
  if (status === "completed") return <CheckCircle2 aria-hidden="true" />;
  if (status === "failed" || status === "timed_out" || status === "interrupted") {
    return <XCircle aria-hidden="true" />;
  }
  if (status === "queued" || status === "assigned") return <Clock3 aria-hidden="true" />;
  return <Activity aria-hidden="true" />;
}

function latestTaskFor(tasks: OfficeTask[], taskType: TaskType): OfficeTask | null {
  return tasks
    .filter((task) => task.task === taskType)
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))[0] ?? null;
}

function CharacterIllustration({
  staff,
  pose = "desk",
  expression = "neutral",
  walkDirection,
}: {
  staff: OfficeStaff;
  pose?: "desk" | "lounge" | "success";
  expression?: "neutral" | "angry";
  walkDirection?: "to-lounge" | "to-desk";
}) {
  let backHair;
  let frontHair;

  switch (staff.hairStyle) {
    case "curls":
      backHair = (
        <g fill={staff.hair}>
          <circle cx="40" cy="31" r="12" /><circle cx="49" cy="17" r="12" />
          <circle cx="62" cy="14" r="13" /><circle cx="75" cy="19" r="12" />
          <circle cx="82" cy="32" r="11" /><circle cx="39" cy="45" r="9" />
        </g>
      );
      frontHair = <path d="M37 35Q42 18 59 19Q76 18 81 36L75 31Q68 35 62 28Q54 37 44 31Z" fill={staff.hair} />;
      break;
    case "long":
      backHair = <path d="M37 34Q38 15 59 15Q82 16 82 40L80 96Q70 108 64 92L62 67L51 95Q37 103 34 88L37 53Z" fill={staff.hair} />;
      frontHair = <path d="M37 35Q38 15 59 15Q80 16 82 35Q72 31 68 25Q59 35 45 32Z" fill={staff.hair} />;
      break;
    case "bun":
      backHair = <g fill={staff.hair}><circle cx="76" cy="18" r="13" /><path d="M37 35Q38 15 59 15Q81 16 81 39L78 62L69 51L43 54L37 42Z" /></g>;
      frontHair = <path d="M38 34Q39 16 59 16Q76 16 80 34L70 30Q59 35 46 29Z" fill={staff.hair} />;
      break;
    case "hijab":
      backHair = <path d="M32 43Q32 11 60 11Q88 12 88 44L83 79Q78 96 60 99Q42 96 37 80Z" fill={staff.outfit} />;
      frontHair = <path d="M41 39Q42 19 60 18Q78 19 79 39L73 33Q60 39 47 33Z" fill={staff.outfit} />;
      break;
    case "fade":
      backHair = <path d="M38 37Q39 17 59 17Q80 17 81 38L76 49L72 33Q59 37 46 32L42 49Z" fill={staff.hair} />;
      frontHair = <path d="M42 32Q49 18 61 19Q72 19 78 31Q66 29 59 27Q52 32 42 32Z" fill={staff.hair} />;
      break;
    case "waves":
      backHair = <path d="M36 38Q35 15 58 14Q82 15 83 39L81 72L74 79L70 50L43 50L40 78L34 69Z" fill={staff.hair} />;
      frontHair = <path d="M37 35Q39 14 59 15Q78 16 81 35Q73 30 68 26Q62 34 55 27Q47 35 37 35Z" fill={staff.hair} />;
      break;
    case "short":
      backHair = <path d="M38 39Q39 17 59 17Q80 17 81 39L76 49L72 34L45 35L42 49Z" fill={staff.hair} />;
      frontHair = <path d="M39 34Q43 17 60 17Q75 17 80 34L69 30L61 25L54 31L44 29Z" fill={staff.hair} />;
      break;
    case "side-part":
      backHair = <path d="M37 39Q37 16 59 16Q82 16 82 40L77 50L73 34L43 36L41 49Z" fill={staff.hair} />;
      frontHair = <path d="M38 35Q41 16 60 16Q76 16 81 33Q72 30 66 25Q58 33 47 31Z" fill={staff.hair} />;
      break;
  }

  return (
    <g className={
      walkDirection === "to-lounge"
        ? styles.walkingToLounge
        : walkDirection === "to-desk"
          ? styles.walkingToDesk
          : undefined
    }>
      {backHair}
      <path d="M45 62L45 77Q60 86 75 77L75 61Z" fill={staff.skin} />
      <path d="M30 79Q38 71 47 70L60 79L73 70Q83 72 91 80L99 126L21 126Z" fill={staff.outfit} />
      <path d="M47 72L60 84L73 72L68 93L60 88L52 93Z" fill={staff.accent} />
      {pose === "success" ? (
        <>
          <path d="M35 83Q27 71 21 59L29 54Q40 67 48 78L43 89Z" fill={staff.outfit} />
          <path d="M85 83Q93 71 99 59L91 54Q80 67 72 78L77 89Z" fill={staff.outfit} />
          <path d="M20 61Q17 55 21 52Q26 51 30 55L34 60L28 65Z" fill={staff.skin} />
          <path d="M100 61Q103 55 99 52Q94 51 90 55L86 60L92 65Z" fill={staff.skin} />
        </>
      ) : (
        <>
          <path d={pose === "lounge" ? "M34 82Q27 91 30 108L44 111L51 98L45 82Z" : "M34 82Q25 88 24 105L43 108L49 98L45 82Z"} fill={staff.outfit} />
          <path d={pose === "lounge" ? "M86 82Q93 91 90 108L76 111L69 98L75 82Z" : "M86 82Q95 89 96 105L77 108L71 98L75 82Z"} fill={staff.outfit} />
          <path d={pose === "lounge" ? "M30 106Q37 103 45 108L47 114Q39 118 30 113Z" : "M27 104Q36 101 47 105L49 112Q38 116 25 111Z"} fill={staff.skin} />
          <path d={pose === "lounge" ? "M90 106Q83 103 75 108L73 114Q81 118 90 113Z" : "M93 104Q83 101 73 105L71 112Q82 116 95 111Z"} fill={staff.skin} />
        </>
      )}
      <path d="M42 120L53 125L51 149L43 149ZM67 125L78 120L77 149L69 149Z" fill="#394c51" />
      <path d="M41 146Q47 144 53 148L54 153L40 153ZM67 148Q73 144 79 146L80 153L66 153Z" fill="#f1eee8" />
      <ellipse cx="60" cy="39" rx="22" ry="26" fill={staff.skin} />
      <ellipse cx="37" cy="42" rx="4" ry="6" fill={staff.skin} />
      <ellipse cx="83" cy="42" rx="4" ry="6" fill={staff.skin} />
      {frontHair}
      <path
        d={expression === "angry" ? "M49 40L56 42M64 42L72 40" : "M49 40Q53 38 56 40M64 40Q68 38 72 40"}
        fill="none"
        stroke={staff.hair}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <ellipse cx="53" cy="44" rx="1.7" ry="2.1" fill="#26333a" />
      <ellipse cx="68" cy="44" rx="1.7" ry="2.1" fill="#26333a" />
      <path d="M60 45L58 53L62 54" fill="none" stroke="#99674f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {staff.facialHair && (
        <path d="M50 56Q55 59 59 56Q64 59 70 55Q68 65 60 65Q52 64 50 56Z" fill={staff.hair} opacity=".92" />
      )}
      <path
        d={expression === "angry" ? "M54 62Q60 57 66 62" : pose === "success" ? "M53 59Q60 68 67 59" : "M55 60Q60 63 65 60"}
        fill="none"
        stroke="#874e43"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </g>
  );
}

function OfficeFloor({
  tasks,
  selectedStaffId,
  onSelectStaff,
  onHoverStaff,
  connection,
  floorMode,
  floorCue,
}: {
  tasks: OfficeTask[];
  selectedStaffId: StaffId;
  onSelectStaff: (id: StaffId) => void;
  onHoverStaff: (id: StaffId | null) => void;
  connection: ConnectionState;
  floorMode: FloorMode;
  floorCue: FloorCue | null;
}) {
  const recentTasks = [...tasks].sort(
    (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
  );
  const activeTask = recentTasks.find((task) => !TERMINAL_STATUSES.has(task.status)) ?? null;

  function drawStation(staff: OfficeStaff, x: number, y: number, width: number, leadership = false) {
    const assignedTask = staff.task ? latestTaskFor(recentTasks, staff.task) : null;
    const employeeTask = assignedTask && !TERMINAL_STATUSES.has(assignedTask.status)
      ? assignedTask
      : null;
    const statusTask = staff.id === "azhar" || staff.id === "khan" ? activeTask : employeeTask;
    const errorCue = floorCue?.kind === "recall" && staff.id === "khan";
    const assignedTaskError = assignedTask &&
      (assignedTask.status === "failed" ||
        assignedTask.status === "timed_out" ||
        assignedTask.status === "interrupted");
    const unavailable = connection !== "connected";
    const status = unavailable
      ? "Status unavailable · backend offline"
      : staff.id === "azhar"
        ? activeTask ? `Team task · ${STATUS_LABELS[activeTask.status]}` : "Idle · no active task"
        : staff.id === "khan"
          ? errorCue
            ? "Alert · team recalled"
            : activeTask ? `Coordinating · ${STATUS_LABELS[activeTask.status]}` : "Idle · awaiting command"
          : employeeTask
            ? `${STATUS_LABELS[employeeTask.status]} · ${TASK_LABELS[employeeTask.task]}`
            : assignedTaskError
              ? floorMode === "lounge"
                ? `Idle · last run ${STATUS_LABELS[assignedTask.status].toLowerCase()}`
                : `Alert · ${STATUS_LABELS[assignedTask.status]}`
              : floorMode === "lounge"
                ? "Idle · in lounge"
                : "Idle · no assigned task";
    const taskName = staff.id === "azhar"
      ? "Office oversight"
      : staff.id === "khan"
        ? activeTask ? TASK_LABELS[activeTask.task] : "No active task"
        : employeeTask ? TASK_LABELS[employeeTask.task] : assignedTask ? TASK_LABELS[assignedTask.task] : "No task assigned";
    const center = width / 2;
    const personY = leadership ? 52 : 0;
    const deskY = leadership ? 174 : 110;
    const labelY = leadership ? 270 : 205;
    const deskWidth = leadership ? 272 : 246;
    const statusColor = unavailable
      ? "#687b76"
      : errorCue || (assignedTaskError && floorMode !== "lounge")
        ? "#a83b45"
        : statusTask
      ? {
          queued: "#8a5a16",
          assigned: "#326179",
          running: "#147451",
          completed: "#147451",
          failed: "#a83b45",
          timed_out: "#a83b45",
          interrupted: "#8a5a16",
        }[statusTask.status]
      : "#687b76";
    const loungePosition = LOUNGE_POSITIONS[staff.id];
    const inLounge = floorMode === "lounge" && !leadership && loungePosition;
    const characterX = inLounge
      ? loungePosition.x - (x + center - 60)
      : 0;
    const characterY = inLounge
      ? loungePosition.y - (y + personY)
      : 0;
    const successPose = floorCue?.kind === "success" && floorCue.staffId === staff.id;
    const activate = () => onSelectStaff(staff.id);
    const alertColor = unavailable ? "#687b76" : errorCue ||
      (assignedTaskError && floorMode !== "lounge")
      ? "#a83b45"
      : "#147451";

    return (
      <g
        key={staff.id}
        className={styles.characterHotspot}
        transform={`translate(${x} ${y})`}
        role="button"
        tabIndex={0}
        aria-label={`${staff.name}, ${staff.title}. Current status: ${status}. ${taskName}.`}
        aria-pressed={selectedStaffId === staff.id}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
        onMouseEnter={() => onHoverStaff(staff.id)}
        onMouseLeave={() => onHoverStaff(null)}
        onFocus={() => onHoverStaff(staff.id)}
        onBlur={() => onHoverStaff(null)}
      >
        <title>{`${staff.name} — ${staff.title}. ${status}. ${taskName}. Select for responsibilities and task history.`}</title>
        <ellipse cx={center} cy={deskY + 45} rx={deskWidth * 0.57} ry="42" fill="#c6d6cf" opacity=".56" />
        <path
          d={`M${center - 29} ${deskY - 12}Q${center - 38} ${deskY - 22} ${center - 31} ${deskY - 35}Q${center} ${deskY - 49} ${center + 31} ${deskY - 35}Q${center + 38} ${deskY - 22} ${center + 29} ${deskY - 12}Z`}
          fill={leadership ? "#647c76" : "#748a83"}
        />
        <path d={`M${center - 22} ${deskY - 21}Q${center} ${deskY - 34} ${center + 22} ${deskY - 21}`} fill="none" stroke="#91aaa1" strokeWidth="3" />
        <g
          className={styles.walkingCharacter}
          transform={`translate(${center - 60 + characterX} ${personY + characterY})`}
        >
          <CharacterIllustration
            staff={staff}
            pose={successPose ? "success" : inLounge ? "lounge" : "desk"}
            expression={errorCue ? "angry" : "neutral"}
            walkDirection={
              leadership
                ? undefined
                : inLounge
                  ? "to-lounge"
                  : floorCue?.kind === "recall"
                    ? "to-desk"
                    : undefined
            }
          />
        </g>
        <path
          d={`M${center - deskWidth / 2 + 11} ${deskY + 9}L${center - deskWidth / 2 + 23} ${deskY + 55}L${center + deskWidth / 2 - 23} ${deskY + 55}L${center + deskWidth / 2 - 11} ${deskY + 9}Z`}
          fill="#9b785e"
        />
        <path
          d={`M${center - deskWidth / 2} ${deskY}L${center + deskWidth / 2} ${deskY}L${center + deskWidth / 2 - 10} ${deskY + 16}L${center - deskWidth / 2 + 10} ${deskY + 16}Z`}
          fill={leadership ? "#e4e6df" : "#f1f1eb"}
          stroke="#a9b5b0"
          strokeWidth="1.5"
        />
        <rect x={center - 24} y={deskY - 27} width="48" height="29" rx="4" fill="#344b4d" />
        <rect x={center - 20} y={deskY - 23} width="40" height="21" rx="2.5" fill="#b9ddd1" />
        <path d={`M${center - 14} ${deskY - 17}h18M${center - 14} ${deskY - 11}h12M${center - 14} ${deskY - 6}h16`} stroke="#588a7b" strokeWidth="2" strokeLinecap="round" />
        <path d={`M${center} ${deskY + 1}v5h12`} fill="none" stroke="#556663" strokeWidth="2" />
        {staff.id === "azhar" && (
          <g transform={`translate(${center - deskWidth / 2 + 23} ${deskY - 24})`}>
            <path d="M0 19h27v4H0z" fill="#d2b88a" />
            <path d="M5 18Q3 7 9 2Q17 5 15 18M14 18Q15 6 22 4Q27 11 22 18" fill="#719879" />
          </g>
        )}
        {staff.id === "khan" && (
          <g transform={`translate(${center + deskWidth / 2 - 49} ${deskY - 22})`}>
            <rect width="25" height="19" rx="2" fill="#e2c89d" />
            <path d="M5 5h15M5 10h11M5 15h13" stroke="#987e5e" strokeWidth="1.5" />
          </g>
        )}
        {staff.id !== "khan" && (
          <g transform={`translate(${center + deskWidth / 2 - 35} ${deskY - 31})`} aria-hidden="true">
            <ellipse cx="9" cy="31" rx="10" ry="3" fill="#a9b5b0" />
            <path d="M9 29V11Q9 6 14 6" fill="none" stroke="#7f8e89" strokeWidth="2" />
            <path d="M12 5Q18 -2 27 4L24 10H12Z" fill="#d7c08f" stroke="#8f8067" strokeWidth="1.3" />
          </g>
        )}
        {!leadership && (
          <g transform={`translate(${center + deskWidth / 2 + 13} ${deskY + 21})`} aria-hidden="true">
            <path d="M0 0h19l-2 27H2Z" fill="#869794" stroke="#5d706c" strokeWidth="1.5" />
            <path d="M-1 0h21" stroke="#4f6562" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        <text x={center} y={labelY} textAnchor="middle" className={styles.floorPersonName}>{staff.name}</text>
        <text x={center} y={labelY + 17} textAnchor="middle" className={styles.floorPersonRole}>{staff.title}</text>
        <circle cx={center - 37} cy={labelY + 34} r="4" fill={statusTask ? statusColor : alertColor} />
        <text x={center - 27} y={labelY + 38} className={styles.floorPersonStatus}>{status}</text>
        {staff.id === "zainab" && (
          <text x={center} y={labelY + 55} textAnchor="middle" className={styles.floorDryRun}>SENDER · DRY-RUN ONLY</text>
        )}
        <rect x="3" y="0" width={width - 6} height={labelY + 60} fill="transparent" pointerEvents="all" />
      </g>
    );
  }

  return (
    <svg
      className={styles.officeFloor}
      viewBox="0 0 1600 1230"
      role="group"
      aria-label="Illustrated AI Khan office floor with eight interactive workstations, a central lounge, and live task statuses"
    >
      <defs>
        <linearGradient id="office-floor-ground" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#edf2f2" />
          <stop offset="1" stopColor="#d7e1e4" />
        </linearGradient>
        <linearGradient id="office-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8ffff" stopOpacity=".78" />
          <stop offset=".55" stopColor="#c6e2e4" stopOpacity=".46" />
          <stop offset="1" stopColor="#a4c6ca" stopOpacity=".58" />
        </linearGradient>
        <pattern id="office-floor-grid" width="72" height="72" patternUnits="userSpaceOnUse">
          <path d="M72 0H0V72" fill="none" stroke="#b8c8cc" strokeWidth="1" opacity=".32" />
        </pattern>
        <filter id="office-soft-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#334b51" floodOpacity=".14" />
        </filter>
      </defs>
      <rect x="0" y="0" width="1600" height="1230" fill="#d6e0e2" />
      <path d="M22 22H1578V1208H22Z" fill="url(#office-floor-ground)" stroke="#fff" strokeWidth="24" strokeLinejoin="round" />
      <path d="M34 34H1566V1196H34Z" fill="url(#office-floor-grid)" />
      <path d="M452 30V1200M1068 30V1200M30 704H452M1070 1044H1565" fill="none" stroke="#c0cdd0" strokeWidth="2" strokeDasharray="6 10" opacity=".75" />

      <g aria-hidden="true">
        <path d="M28 140H1572M28 1200H1572M28 140V1200M1572 140V1200" fill="none" stroke="#fff" strokeWidth="18" strokeLinejoin="round" />
        <path d="M455 380H1065V435M1065 525V590M1065 700V1044" fill="none" stroke="#fff" strokeWidth="15" strokeLinejoin="round" />
        <rect x="438" y="28" width="635" height="345" rx="10" fill="url(#office-glass)" stroke="#fff" strokeWidth="10" />
        <path d="M628 38V365M836 38V365M1040 38V365M446 260H1065" fill="none" stroke="#8eabb0" strokeWidth="3" opacity=".8" />
        <path d="M446 266H1065M633 42V255M841 42V255M1046 42V255" fill="none" stroke="#fff" strokeWidth="3" opacity=".85" />
        <rect x="884" y="83" width="136" height="78" rx="4" fill="#fafbf8" stroke="#9eafb0" strokeWidth="2" />
        <path d="M897 101h107M897 112h78M897 123h95M897 143h44" stroke="#9aafa8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="1003" cy="147" r="4" fill="#d5aa67" />
        <path d="M28 765H454V1200H28Z" fill="#d9e3e1" fillOpacity=".58" stroke="#fff" strokeWidth="11" />
        <path d="M454 765V1200M28 765H454" fill="none" stroke="#9bb5b6" strokeWidth="3" />
        <path d="M191 765V805M260 765V805" stroke="#fff" strokeWidth="12" />
        <text x="56" y="800" className={styles.floorZoneLabel}>AZHAR · PRIVATE OFFICE</text>
        <text x="470" y="64" className={styles.floorZoneLabel}>KHAN · GLASS MANAGER CABIN</text>
        <text x="492" y="395" className={styles.floorZoneLabel}>SHARED LOUNGE</text>
        <text x="1114" y="160" className={styles.floorZoneLabel}>OPERATIONS DESKS</text>
        <text x="1114" y="183" className={styles.floorSubLabel}>SIX SCRIPT-BACKED EMPLOYEES</text>
      </g>

      <g aria-hidden="true" filter="url(#office-soft-shadow)">
        <rect x="60" y="44" width="230" height="72" rx="9" fill="#f8faf8" stroke="#b9c9c8" strokeWidth="2" />
        <rect x="75" y="55" width="58" height="47" rx="4" fill="#53686c" />
        <rect x="82" y="62" width="44" height="32" rx="2" fill="#23383d" />
        <path d="M88 70h31M88 78h24M88 86h34" stroke="#8dd2bd" strokeWidth="2" strokeLinecap="round" />
        <rect x="145" y="55" width="58" height="47" rx="4" fill="#53686c" />
        <rect x="152" y="62" width="44" height="32" rx="2" fill="#23383d" />
        <path d="M158 70h31M158 78h24M158 86h34" stroke="#8dd2bd" strokeWidth="2" strokeLinecap="round" />
        <rect x="215" y="55" width="58" height="47" rx="4" fill="#53686c" />
        <rect x="222" y="62" width="44" height="32" rx="2" fill="#23383d" />
        <path d="M228 70h31M228 78h24M228 86h34" stroke="#8dd2bd" strokeWidth="2" strokeLinecap="round" />
        <text x="60" y="132" className={styles.floorSubLabel}>SERVER RACKS</text>

        <rect x="322" y="47" width="53" height="91" rx="8" fill="#f7fbfa" stroke="#b7c8c8" strokeWidth="2" />
        <rect x="331" y="57" width="35" height="35" rx="4" fill="#d9edf0" stroke="#a5bec0" />
        <path d="M348 93v22M339 116h18M336 129h24" stroke="#719397" strokeWidth="3" strokeLinecap="round" />
        <path d="M348 94v10" stroke="#69adbb" strokeWidth="3" />
        <text x="311" y="158" className={styles.floorSubLabel}>WATER</text>

        <circle cx="1170" cy="82" r="31" fill="#fff" stroke="#9eafb1" strokeWidth="3" />
        <circle cx="1170" cy="82" r="3" fill="#52666b" />
        <path d="M1170 82V62M1170 82l15 9" stroke="#52666b" strokeWidth="3" strokeLinecap="round" />
        <text x="1141" y="130" className={styles.floorSubLabel}>10:10</text>

        <rect x="1357" y="34" width="165" height="112" rx="7" fill="#eef2ef" stroke="#b8c6c4" strokeWidth="3" />
        <path d="M1439 36V144M1360 41H1437M1442 41H1518" stroke="#a7b6b5" strokeWidth="2" />
        <circle cx="1426" cy="91" r="3" fill="#718983" />
        <circle cx="1452" cy="91" r="3" fill="#718983" />
        <text x="1386" y="166" className={styles.floorSubLabel}>DOUBLE ENTRY</text>

        <g transform="translate(88 1150)">
          <path d="M3 0h46l-6 28H9Z" fill="#c3a17e" />
          <path d="M12 5h28v18H12Z" fill="#f9faf7" />
          <path d="M17 11h18M17 16h13" stroke="#bac4bf" strokeWidth="2" />
        </g>
        <g transform="translate(370 874)">
          <ellipse cx="0" cy="0" rx="59" ry="37" fill="#fff" stroke="#aa8d70" strokeWidth="4" />
          <path d="M-39-5h19M7 10h24" stroke="#c9a981" strokeWidth="3" strokeLinecap="round" />
          <rect x="-16" y="-13" width="19" height="14" rx="2" fill="#f8f6ef" stroke="#bdc7c0" />
          <path d="M-12-8h11M-12-4h8" stroke="#abb8b2" strokeWidth="1.5" />
          <path d="M-43-48q-7-13 3-24q12 11 2 24m15 0q-3-18 12-27q8 17-6 27" fill="#7e9c83" stroke="#5b7a64" strokeWidth="2" />
          <path d="M-46-50h35v8h-35Z" fill="#ad8b70" />
        </g>

        <rect x="500" y="418" width="470" height="383" rx="28" fill="#d3cbc0" opacity=".62" />
        <rect x="512" y="430" width="446" height="359" rx="22" fill="#e8e2d7" stroke="#c4b8a8" strokeWidth="2" />
        <path d="M522 442H948M522 778H948" stroke="#d4c9ba" strokeWidth="2" strokeDasharray="3 8" />
        <rect x="599" y="406" width="258" height="75" rx="23" fill="#879c91" stroke="#60776d" strokeWidth="3" />
        <rect x="615" y="415" width="226" height="48" rx="14" fill="#a9bdb1" />
        <path d="M620 466v19M836 466v19" stroke="#725f51" strokeWidth="6" strokeLinecap="round" />
        <rect x="620" y="554" width="221" height="74" rx="13" fill="#bd9b7d" stroke="#98795f" strokeWidth="3" />
        <path d="M642 567h177M642 577h127" stroke="#d7c0a5" strokeWidth="3" strokeLinecap="round" />
        <rect x="885" y="405" width="58" height="70" rx="9" fill="#f5f8f6" stroke="#a8bcba" strokeWidth="2" />
        <rect x="896" y="415" width="36" height="24" rx="4" fill="#d6ebed" />
        <path d="M914 440v14M905 455h19M899 466h31" stroke="#759294" strokeWidth="3" strokeLinecap="round" />
        <rect x="520" y="408" width="55" height="64" rx="7" fill="#f4f7f5" stroke="#a5b8b4" strokeWidth="2" />
        <rect x="529" y="417" width="37" height="25" rx="4" fill="#40595a" />
        <path d="M534 424h27M534 431h20" stroke="#b6e4d4" strokeWidth="2" />
        <path d="M537 450h21l-3 13h-15Z" fill="#c59d76" />
        <text x="524" y="489" className={styles.floorSubLabel}>COFFEE</text>
      </g>

      <g aria-hidden="true">
        <path d="M74 692q-14-23 4-40q17 17 2 40m10 0q-5-29 17-41q11 23-8 41m0 0H73" fill="#789981" stroke="#5f8068" strokeWidth="2" />
        <path d="M1195 1128q-14-23 4-40q17 17 2 40m10 0q-5-29 17-41q11 23-8 41m0 0h-26" fill="#789981" stroke="#5f8068" strokeWidth="2" />
        <path d="M1034 683q-14-23 4-40q17 17 2 40m10 0q-5-29 17-41q11 23-8 41m0 0h-26" fill="#789981" stroke="#5f8068" strokeWidth="2" />
        <rect x="80" y="664" width="30" height="28" rx="4" fill="#aa8b70" />
        <rect x="1207" y="1100" width="30" height="28" rx="4" fill="#aa8b70" />
        <rect x="1022" y="655" width="30" height="28" rx="4" fill="#aa8b70" />
        <path d="M74 847v-54M74 795l-17-19M74 795l17-19M74 808l-18 17M74 808l18 17" fill="none" stroke="#6a7774" strokeWidth="4" strokeLinecap="round" />
        <path d="M56 777q8-11 17 0l-2 23H57ZM90 777q-8-11-17 0l2 23h14Z" fill="#a87d73" stroke="#815f59" strokeWidth="1.5" />
      </g>

      {drawStation(OFFICE_STAFF[0], STAFF_STATIONS.azhar.x, STAFF_STATIONS.azhar.y, STAFF_STATIONS.azhar.width, true)}
      {drawStation(OFFICE_STAFF[1], STAFF_STATIONS.khan.x, STAFF_STATIONS.khan.y, STAFF_STATIONS.khan.width, true)}
      {drawStation(OFFICE_STAFF[2], STAFF_STATIONS.ali.x, STAFF_STATIONS.ali.y, STAFF_STATIONS.ali.width)}
      {drawStation(OFFICE_STAFF[3], STAFF_STATIONS.ayesha.x, STAFF_STATIONS.ayesha.y, STAFF_STATIONS.ayesha.width)}
      {drawStation(OFFICE_STAFF[4], STAFF_STATIONS.hassan.x, STAFF_STATIONS.hassan.y, STAFF_STATIONS.hassan.width)}
      {drawStation(OFFICE_STAFF[5], STAFF_STATIONS.sara.x, STAFF_STATIONS.sara.y, STAFF_STATIONS.sara.width)}
      {drawStation(OFFICE_STAFF[6], STAFF_STATIONS.usman.x, STAFF_STATIONS.usman.y, STAFF_STATIONS.usman.width)}
      {drawStation(OFFICE_STAFF[7], STAFF_STATIONS.zainab.x, STAFF_STATIONS.zainab.y, STAFF_STATIONS.zainab.width)}
      {floorMode === "lounge" && !floorCue && (
        <g className={styles.loungeBanter} aria-label="Casual lounge chat, not a work-status message: Anyone for coffee?">
          <path d="M686 389h204q10 0 10 10v28q0 10-10 10h-111l-10 12-10-12h-73q-10 0-10-10v-28q0-10 10-10Z" fill="#fff" stroke="#a9b9b2" strokeWidth="2" />
          <text x="704" y="416" className={styles.floorCueCopy}>Anyone for coffee?</text>
        </g>
      )}
      {floorCue && (
        <g
          key={floorCue.sequence}
          className={styles.floorCueBubble}
          transform={`translate(${floorCue.kind === "success" ? 880 : 900} ${floorCue.kind === "success" ? 325 : 350})`}
          role="status"
          aria-live="polite"
        >
          <path d="M0 0h282q12 0 12 12v45q0 12-12 12h-128l-12 17-12-17H12Q0 69 0 57Z" fill={floorCue.kind === "success" ? "#e5f6ed" : "#fff0ed"} stroke={floorCue.kind === "success" ? "#71ae8f" : "#d5978d"} strokeWidth="2" />
          <text x="17" y="25" className={styles.floorCueTitle}>{floorCue.kind === "success" ? "TASK COMPLETE" : "KHAN · CHECK IN"}</text>
          <text x="17" y="48" className={styles.floorCueCopy}>{floorCue.message}</text>
        </g>
      )}
    </svg>
  );
}

function PitchDraftEditor({
  leadName,
  email,
  initialSubject,
  initialBody,
  sourceTaskId,
  revision,
  onSaved,
}: {
  leadName: string;
  email: string;
  initialSubject: string;
  initialBody: string;
  sourceTaskId?: string;
  revision: number;
  onSaved: () => void;
}) {
  const id = useId();
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setSubject(initialSubject);
    setBody(initialBody);
    setSaved(false);
    setError("");
    setFeedback("");
    setLoading(true);
    const params = new URLSearchParams({ lead_name: leadName });
    if (sourceTaskId) params.set("source_task_id", sourceTaskId);
    void requestJson(`/api/office/drafts?${params}`, { signal: controller.signal })
      .then((payload) => {
        const draft = parsePitchDraft(payload);
        if (draft) {
          setSubject(draft.subject);
          setBody(draft.body);
          setSaved(draft.saved);
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not load pitch draft.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [leadName, initialSubject, initialBody, sourceTaskId, revision]);

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const payload: {
        lead_name: string;
        email: string;
        subject: string;
        body: string;
        source_task_id?: string;
      } = { lead_name: leadName, email, subject, body };
      if (sourceTaskId) payload.source_task_id = sourceTaskId;
      const result = await requestJson("/api/office/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Desk": "1" },
        body: JSON.stringify(payload),
      });
      const draft = parsePitchDraft(result);
      if (!draft?.saved) throw new Error("The office API did not confirm the saved draft.");
      setSubject(draft.subject);
      setBody(draft.body);
      setSaved(true);
      setFeedback("Draft saved to SQLite.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save pitch draft.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.pitchEditor} onSubmit={saveDraft}>
      <div className={styles.pitchEditorHeading}>
        <strong>Pitch draft</strong>
        <span>{loading ? "Loading…" : saved ? "Saved draft" : "Generated preview"}</span>
      </div>
      <label className={styles.workspaceField} htmlFor={`${id}-subject`}>Subject</label>
      <input
        className={styles.pitchInput}
        id={`${id}-subject`}
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
        maxLength={500}
        required
      />
      <label className={styles.workspaceField} htmlFor={`${id}-body`}>Full message</label>
      <textarea
        className={styles.pitchTextarea}
        id={`${id}-body`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={12_000}
        rows={9}
        required
      />
      {error && <p className={styles.workspaceError} role="alert">{error}</p>}
      {feedback && <p className={styles.workspaceFeedback} role="status">{feedback}</p>}
      <button
        className={styles.workspacePrimaryButton}
        type="submit"
        disabled={loading || saving || !subject.trim() || !body.trim()}
      >
        {saving ? "Saving draft…" : "Save draft"}
      </button>
    </form>
  );
}

export function OfficeClient() {
  const [tasks, setTasks] = useState<OfficeTask[]>([]);
  const [events, setEvents] = useState<OfficeEvent[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectActivities, setProspectActivities] = useState<ProspectActivity[]>([]);
  const [prospectActivityRevision, setProspectActivityRevision] = useState(0);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskType>("discover");
  const [leadName, setLeadName] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<OfficeTask | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<StaffId>("khan");
  const [hoveredStaffId, setHoveredStaffId] = useState<StaffId | null>(null);
  const [floorMode, setFloorMode] = useState<FloorMode>("desks");
  const [floorCue, setFloorCue] = useState<FloorCue | null>(null);
  const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
  const [selectedLeadName, setSelectedLeadName] = useState("");
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectStatusFilter, setProspectStatusFilter] = useState("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [prospectLoading, setProspectLoading] = useState(true);
  const [prospectActivityLoading, setProspectActivityLoading] = useState(false);
  const [prospectActivityError, setProspectActivityError] = useState("");
  const [prospectError, setProspectError] = useState("");
  const [prospectActionError, setProspectActionError] = useState("");
  const [prospectFeedback, setProspectFeedback] = useState("");
  const [prospectFormOpen, setProspectFormOpen] = useState(false);
  const [prospectSaving, setProspectSaving] = useState(false);
  const [updatingProspectId, setUpdatingProspectId] = useState<number | null>(null);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState("");
  const [leadActionError, setLeadActionError] = useState("");
  const [leadFeedback, setLeadFeedback] = useState("");
  const [optingOutEmail, setOptingOutEmail] = useState("");
  const [pitchDraftRevision, setPitchDraftRevision] = useState(0);
  const selectedTaskIdRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastRecoveryRef = useRef(0);
  const floorCueTimerRef = useRef<number | null>(null);
  const floorCueSequenceRef = useRef(0);
  const floorCueEventsRef = useRef(new Set<string>());

  const showFloorCue = useCallback((cue: Omit<FloorCue, "sequence">) => {
    setFloorMode("desks");
    setFloorCue({ ...cue, sequence: ++floorCueSequenceRef.current });
    if (floorCueTimerRef.current !== null) window.clearTimeout(floorCueTimerRef.current);
    floorCueTimerRef.current = window.setTimeout(() => {
      setFloorCue(null);
      floorCueTimerRef.current = null;
    }, cue.kind === "success" ? 1_600 : 2_400);
  }, []);

  const refreshProspects = useCallback(async () => {
    try {
      const latestProspects = parseProspectList(await requestJson("/api/prospects"));
      setProspects(latestProspects);
      setProspectActivityRevision((revision) => revision + 1);
      setProspectError("");
    } catch (error) {
      setProspectError(error instanceof Error ? error.message : "Could not load prospects.");
    } finally {
      setProspectLoading(false);
    }
  }, []);

  const refreshLeads = useCallback(async () => {
    try {
      const latestLeads = parseLeadList(await requestJson("/api/local/leads"));
      setLeads(latestLeads);
      setLeadsError("");
    } catch (error) {
      setLeadsError(error instanceof Error ? error.message : "Could not load script leads.");
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const refreshTaskList = useCallback(async (): Promise<OfficeTask[] | null> => {
    try {
      const latestTasks = parseTaskList(await requestJson("/api/office/tasks"));
      setTasks(latestTasks);
      setBackendError("");
      if (!selectedTaskIdRef.current && latestTasks[0]) {
        selectedTaskIdRef.current = latestTasks[0].id;
        setSelectedTaskId(latestTasks[0].id);
      }
      return latestTasks;
    } catch (error) {
      setBackendError(
        error instanceof Error ? error.message : "Could not connect to the office backend.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSnapshot = useCallback((): Promise<void> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    const refresh = (async () => {
      const latestTasks = await refreshTaskList();
      if (!latestTasks) return;

      const eventResults = await Promise.all(
        latestTasks.slice(0, 20).map(async (task) => {
          try {
            const result = await requestJson(
              `/api/office/tasks/${encodeURIComponent(task.id)}/events`,
            );
            return parseEventList(result);
          } catch (error) {
            setBackendError(
              error instanceof Error ? error.message : "Could not reload persisted task events.",
            );
            return [];
          }
        }),
      );
      setEvents((current) => mergeEvents(current, eventResults.flat()));
    })()
      .finally(() => {
        refreshPromiseRef.current = null;
      });
    refreshPromiseRef.current = refresh;
    return refresh;
  }, [refreshTaskList]);

  useEffect(() => {
    void refreshSnapshot();
    const eventSource = new EventSource("/api/office/events");
    eventSource.onopen = () => {
      setConnection("connected");
      void refreshSnapshot();
    };
    eventSource.onerror = () => {
      setConnection("reconnecting");
      const now = Date.now();
      if (now - lastRecoveryRef.current > 4_000) {
        lastRecoveryRef.current = now;
        void refreshSnapshot();
      }
    };
    eventSource.addEventListener("task", (rawEvent: Event) => {
      try {
        const eventValue: unknown = JSON.parse((rawEvent as MessageEvent<string>).data);
        if (!isOfficeEvent(eventValue)) {
          throw new Error("The office event had an invalid format.");
        }
        const event = eventValue;
        setEvents((current) => mergeEvents(current, [event]));
        if (event.type !== "output") {
          void refreshTaskList().then((latestTasks) => {
            const task = latestTasks?.find((item) => item.id === event.task_id);
            if (event.type === "completed" && task?.task === "import") {
              void refreshProspects();
            }
            if (!task) return;
            const cueType = event.type === "queued" || event.type === "assigned"
              ? "recall"
              : event.type === "failed" || event.type === "timed_out"
                ? "recall"
                : event.type === "completed" && task.status === "completed"
                  ? "success"
                  : null;
            if (!cueType) return;
            const cueKey = `${event.task_id}:${cueType}`;
            if (floorCueEventsRef.current.has(cueKey)) return;
            floorCueEventsRef.current.add(cueKey);
            const employee = EMPLOYEES.find((item) => item.task === task.task);
            showFloorCue({
              kind: cueType,
              taskId: task.id,
              staffId: cueType === "success" ? OFFICE_STAFF.find((staff) => staff.task === task.task)?.id : undefined,
              message: cueType === "success"
                ? `${employee?.name ?? "The team"} completed ${TASK_LABELS[task.task]}.`
                : event.type === "queued" || event.type === "assigned"
                  ? `${employee?.name ?? "An employee"} is heading to their workstation.`
                  : "An execution issue needs Khan’s review.",
            });
          });
        }
      } catch {
        setBackendError("Received an unreadable event from the office backend.");
      }
    });
    return () => eventSource.close();
  }, [refreshSnapshot, refreshTaskList, refreshProspects, showFloorCue]);

  useEffect(() => {
    void refreshProspects();
  }, [refreshProspects]);

  useEffect(() => {
    void refreshLeads();
  }, [refreshLeads]);

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskDetail(null);
      return;
    }
    const controller = new AbortController();
    void requestJson(
      `/api/office/tasks/${encodeURIComponent(selectedTaskId)}`,
      { signal: controller.signal },
    )
      .then((payload) => setTaskDetail(parseTaskDetails(payload)))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setBackendError(
            error instanceof Error ? error.message : "Could not load task details.",
          );
        }
      });
    return () => controller.abort();
  }, [selectedTaskId, tasks]);

  const recentTasks = useMemo(
    () => [...tasks].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
    [tasks],
  );
  const latestTasksByType = useMemo(() => {
    const latest = new Map<TaskType, OfficeTask>();
    for (const task of recentTasks) {
      if (!latest.has(task.task)) latest.set(task.task, task);
    }
    return latest;
  }, [recentTasks]);
  const activeTask = recentTasks.find((task) => !TERMINAL_STATUSES.has(task.status)) ?? null;
  const activeTaskKey = activeTask ? `${activeTask.id}:${activeTask.status}` : null;
  useEffect(() => {
    if (connection !== "connected" || loading || activeTaskKey !== null || floorCue) {
      setFloorMode("desks");
      return;
    }
    const idleTimer = window.setTimeout(() => setFloorMode("lounge"), 5_000);
    return () => window.clearTimeout(idleTimer);
  }, [connection, loading, activeTaskKey, floorCue]);

  useEffect(() => () => {
    if (floorCueTimerRef.current !== null) window.clearTimeout(floorCueTimerRef.current);
  }, []);

  const displayedStaff = OFFICE_STAFF.find(
    (staff) => staff.id === (hoveredStaffId ?? selectedStaffId),
  ) ?? OFFICE_STAFF[1];
  const displayedStaffTask = displayedStaff.task
    ? latestTasksByType.get(displayedStaff.task) ?? null
    : null;
  const displayedEmployeeTask = displayedStaffTask &&
    !TERMINAL_STATUSES.has(displayedStaffTask.status)
    ? displayedStaffTask
    : null;
  const displayedStaffStatus = connection !== "connected"
    ? "Status unavailable · backend offline"
    : displayedStaff.id === "azhar"
      ? activeTask ? `Working · team ${STATUS_LABELS[activeTask.status].toLowerCase()}` : "Idle · no active task"
      : displayedStaff.id === "khan"
        ? floorCue?.kind === "recall"
          ? "Alert · team recalled"
          : activeTask ? `Coordinating · ${STATUS_LABELS[activeTask.status]}` : "Idle · awaiting command"
        : displayedEmployeeTask
          ? `${STATUS_LABELS[displayedEmployeeTask.status]} · ${TASK_LABELS[displayedEmployeeTask.task]}`
          : displayedStaffTask &&
              (displayedStaffTask.status === "failed" ||
                displayedStaffTask.status === "timed_out" ||
                displayedStaffTask.status === "interrupted")
            ? floorMode === "lounge"
              ? `Idle · last run ${STATUS_LABELS[displayedStaffTask.status].toLowerCase()}`
              : `Alert · ${STATUS_LABELS[displayedStaffTask.status]}`
            : floorMode === "lounge"
              ? "Idle · in lounge"
              : "Idle · no assigned task";
  const displayedStaffStatusTask = connection !== "connected"
    ? null
    : floorMode === "lounge" && !displayedEmployeeTask
      ? null
      : displayedStaff.task ? displayedStaffTask : activeTask;
  const displayedStaffHistory = displayedStaff.task
    ? recentTasks.filter((task) => task.task === displayedStaff.task).slice(0, 5)
    : recentTasks.slice(0, 5);

  function chooseTask(taskId: string) {
    selectedTaskIdRef.current = taskId;
    setSelectedTaskId(taskId);
  }

  function chooseStaff(staffId: StaffId) {
    setSelectedStaffId(staffId);
    setHoveredStaffId(null);
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      const body: { task: TaskType; lead_name?: string } = { task: selectedTask };
      if (selectedTask === "pitch" && leadName.trim()) body.lead_name = leadName.trim();
      const result = await requestJson("/api/office/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Desk": "1",
        },
        body: JSON.stringify(body),
      });
      const task = parseTaskDetails(result);
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
      chooseTask(task.id);
      void refreshSnapshot();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Task submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const filteredProspects = useMemo(() => {
    const query = prospectSearch.trim().toLocaleLowerCase();
    return prospects.filter((prospect) => {
      const matchesQuery = !query ||
        [prospect.name, prospect.category, prospect.city, prospect.email, prospect.phone]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      return matchesQuery &&
        (prospectStatusFilter === "all" || prospect.status === prospectStatusFilter);
    });
  }, [prospects, prospectSearch, prospectStatusFilter]);

  const selectedProspect = filteredProspects.find(
    (prospect) => prospect.id === selectedProspectId,
  ) ?? filteredProspects[0] ?? null;
  const selectedProspectActivityId = selectedProspect?.id ?? null;

  useEffect(() => {
    if (selectedProspectActivityId === null) {
      setProspectActivities([]);
      setProspectActivityLoading(false);
      setProspectActivityError("");
      return;
    }
    const controller = new AbortController();
    setProspectActivities([]);
    setProspectActivityLoading(true);
    setProspectActivityError("");
    void requestJson(`/api/prospects/${selectedProspectActivityId}/activity`, {
      signal: controller.signal,
    })
      .then((payload) => setProspectActivities(parseProspectActivity(payload)))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setProspectActivityError(
            cause instanceof Error ? cause.message : "Could not load prospect activity.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setProspectActivityLoading(false);
      });
    return () => controller.abort();
  }, [selectedProspectActivityId, prospectActivityRevision]);

  const filteredLeads = useMemo(() => {
    const query = leadSearch.trim().toLocaleLowerCase();
    return leads.filter((lead) => {
      const matchesQuery = !query ||
        [lead.name, lead.email, ...lead.all_emails, lead.phone, lead.website, lead.address]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      return matchesQuery && (leadStatusFilter === "all" || lead.status === leadStatusFilter);
    });
  }, [leads, leadSearch, leadStatusFilter]);

  const selectedLead = filteredLeads.find((lead) => lead.name === selectedLeadName) ??
    filteredLeads[0] ?? null;

  async function createProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProspectSaving(true);
    setProspectActionError("");
    setProspectFeedback("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      name: String(values.get("name") ?? "").trim(),
      category: String(values.get("category") ?? "").trim(),
      city: String(values.get("city") ?? "").trim(),
      email: String(values.get("email") ?? "").trim(),
      phone: String(values.get("phone") ?? "").trim(),
      website_url: String(values.get("website_url") ?? "").trim(),
    };
    try {
      const created = await requestJson("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!isProspect(created)) {
        throw new Error("The prospects API returned an invalid new record.");
      }
      setProspects((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedProspectId(created.id);
      setProspectSearch("");
      setProspectStatusFilter("all");
      setProspectFormOpen(false);
      setProspectFeedback(`${created.name} was saved to the local workspace.`);
      form.reset();
    } catch (error) {
      setProspectActionError(error instanceof Error ? error.message : "Could not save prospect.");
    } finally {
      setProspectSaving(false);
    }
  }

  async function updateProspectStatus(id: number, status: ProspectStatus) {
    setUpdatingProspectId(id);
    setProspectActionError("");
    setProspectFeedback("");
    try {
      const updated = await requestJson(`/api/prospects/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!isProspect(updated)) {
        throw new Error("The prospects API returned an invalid updated record.");
      }
      setProspects((current) => current.map((item) => item.id === id ? updated : item));
      setProspectActivityRevision((revision) => revision + 1);
      setProspectFeedback(`${updated.name} status saved as ${PROSPECT_STATUS_LABELS[updated.status]}.`);
    } catch (error) {
      setProspectActionError(error instanceof Error ? error.message : "Could not update prospect status.");
      void refreshProspects();
    } finally {
      setUpdatingProspectId(null);
    }
  }

  function exportProspects(format: "csv" | "json") {
    if (format === "json") {
      downloadRecords(
        `ai-khan-prospects-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(filteredProspects, null, 2),
        "application/json;charset=utf-8",
      );
      return;
    }
    const columns: Array<[keyof Prospect, string]> = [
      ["name", "Business"], ["category", "Category"], ["city", "City"],
      ["email", "Email"], ["phone", "Phone"], ["website", "Website"],
      ["score", "Score"], ["status", "Status"], ["isDemo", "Demo record"],
      ["createdAt", "Created at"], ["updatedAt", "Updated at"],
    ];
    const rows = [
      columns.map(([, label]) => csvCell(label)).join(","),
      ...filteredProspects.map((prospect) =>
        columns.map(([key]) => csvCell(prospect[key])).join(","),
      ),
    ];
    downloadRecords(
      `ai-khan-prospects-${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${rows.join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
  }

  function exportLeads(format: "csv" | "json") {
    if (format === "json") {
      downloadRecords(
        `ai-khan-leads-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(filteredLeads, null, 2),
        "application/json;charset=utf-8",
      );
      return;
    }
    const columns: Array<[keyof Lead, string]> = [
      ["name", "Business"], ["email", "Email"], ["all_emails", "Other emails"],
      ["phone", "Phone"], ["website", "Website"], ["address", "Address"],
      ["score", "Score"], ["status", "Status"], ["sent_at", "Sent at"],
    ];
    const rows = [
      columns.map(([, label]) => csvCell(label)).join(","),
      ...filteredLeads.map((lead) =>
        columns.map(([key]) =>
          csvCell(key === "all_emails" ? lead.all_emails.join("; ") : lead[key]),
        ).join(","),
      ),
    ];
    downloadRecords(
      `ai-khan-leads-${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${rows.join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
  }

  async function optOutLead(lead: Lead) {
    if (!lead.email || lead.status === "opted-out") return;
    if (!window.confirm(`Add ${lead.email} to the local opt-out list? This does not send an email.`)) {
      return;
    }
    setOptingOutEmail(lead.email);
    setLeadActionError("");
    setLeadFeedback("");
    try {
      const result = await requestJson("/api/local/optout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Desk": "1",
        },
        body: JSON.stringify({ email: lead.email }),
      });
      if (!isRecord(result) || result.ok !== true) {
        throw new Error("The local API did not confirm the opt-out.");
      }
      setLeadFeedback(`${lead.email} was added to the local opt-out list.`);
      await refreshLeads();
    } catch (error) {
      setLeadActionError(error instanceof Error ? error.message : "Could not save opt-out.");
    } finally {
      setOptingOutEmail("");
    }
  }

  const selectedDetail = taskDetail?.id === selectedTaskId ? taskDetail : null;
  const taskPitch = selectedDetail?.task === "pitch" &&
    isRecord(selectedDetail.result) &&
    typeof selectedDetail.result.name === "string" &&
    typeof selectedDetail.result.subject === "string" &&
    typeof selectedDetail.result.body === "string"
    ? {
        name: selectedDetail.result.name,
        subject: selectedDetail.result.subject,
        body: selectedDetail.result.body,
      }
    : null;
  const connectionLabel = {
    connecting: "Connecting",
    connected: "Backend connected",
    reconnecting: "Reconnecting",
  }[connection];

  return (
    <main className={styles.office}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/office" aria-label="AI Khan Command Center">
          <Image
            className={styles.brandLogo}
            src="/brand/ai-khan-mark.png"
            alt=""
            width={806}
            height={513}
            priority
          />
          <span className={styles.brandText}>
            <strong>AI KHAN</strong>
            <small>COMMAND CENTER</small>
          </span>
        </Link>
        <div className={styles.topbarRight}>
          <span className={styles.localBadge}><ShieldCheck aria-hidden="true" /> Local workspace</span>
          <span
            className={`${styles.connectionBadge} ${
              connection === "connected" ? styles.connectionOnline : styles.connectionWaiting
            }`}
            role="status"
            aria-live="polite"
          >
            {connection === "connected"
              ? <Wifi aria-hidden="true" />
              : <WifiOff aria-hidden="true" />}
            {connectionLabel}
          </span>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.pageIntro}>
          <div>
            <p className={styles.eyebrow}>OPERATIONS FLOOR <span>•</span> PHASE 2</p>
            <h1>Good work starts with a clear brief.</h1>
            <p className={styles.introCopy}>
              Assign an approved task to the team. Status and activity come directly from the local Python task engine.
            </p>
          </div>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void refreshSnapshot()}
            aria-label="Refresh task history"
          >
            <RefreshCw aria-hidden="true" />
            Refresh
          </button>
        </section>

        {backendError && (
          <div className={styles.errorBanner} role="alert">
            <WifiOff aria-hidden="true" />
            <div>
              <strong>Office backend unavailable</strong>
              <p>{backendError}</p>
            </div>
          </div>
        )}

        <section className={styles.commandGrid} aria-label="Team leadership and task dispatch">
          <div className={styles.leadershipPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>LEADERSHIP</p>
                <h2>The office</h2>
              </div>
              <span className={styles.liveLabel}><span /> Local-first</span>
            </div>
            <div className={styles.leaderRow}>
              <div className={`${styles.leaderCard} ${styles.bossCard}`}>
                <span className={styles.leaderAvatar}><UserRound aria-hidden="true" /></span>
                <div>
                  <span className={styles.leaderTitle}>BOSS</span>
                  <strong>Azhar</strong>
                  <small>Final decision-maker</small>
                </div>
                <ArrowUpRight className={styles.leaderArrow} aria-hidden="true" />
              </div>
              <div className={styles.leaderConnector} aria-hidden="true">→</div>
              <div className={`${styles.leaderCard} ${styles.managerCard}`}>
                <span className={styles.leaderAvatar}><Command aria-hidden="true" /></span>
                <div>
                  <span className={styles.leaderTitle}>SENIOR MANAGER</span>
                  <strong>Khan</strong>
                  <small>Routes work to the team</small>
                </div>
                <ArrowUpRight className={styles.leaderArrow} aria-hidden="true" />
              </div>
            </div>
            <div className={styles.currentTask} aria-live="polite">
              <span className={styles.currentIcon}>{activeTask ? stateIcon(activeTask.status) : <CircleHelp aria-hidden="true" />}</span>
              <div className={styles.currentCopy}>
                <span className={styles.kicker}>CURRENT TASK</span>
                <strong>{activeTask ? TASK_LABELS[activeTask.task] : "No task in progress"}</strong>
                <small>
                  {activeTask
                    ? `${displayTaskName(activeTask.task)} · submitted ${formatTime(activeTask.created_at)}`
                    : "The team is ready for an approved task."}
                </small>
              </div>
              {activeTask && (
                <span className={`${styles.statusPill} ${STATUS_CLASSES[activeTask.status]}`}>
                  {STATUS_LABELS[activeTask.status]}
                </span>
              )}
            </div>
          </div>

          <section className={styles.dispatchPanel} aria-labelledby="dispatch-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>TASK DISPATCH</p>
                <h2 id="dispatch-title">Give Khan a task</h2>
              </div>
              <span className={styles.dispatchIcon}><Command aria-hidden="true" /></span>
            </div>
            <form onSubmit={submitTask}>
              <label className={styles.fieldLabel} htmlFor="task-select">Approved task</label>
              <select
                className={styles.select}
                id="task-select"
                value={selectedTask}
                onChange={(event) => setSelectedTask(event.target.value as TaskType)}
              >
                {EMPLOYEES.map((employee) => (
                  <option key={employee.task} value={employee.task}>
                    {employee.name} — {TASK_LABELS[employee.task]}
                    {employee.task === "send" ? " (dry-run only)" : ""}
                  </option>
                ))}
              </select>
              {selectedTask === "pitch" && (
                <>
                  <label className={styles.fieldLabel} htmlFor="lead-name">Lead name <span>Optional</span></label>
                  <input
                    className={styles.input}
                    id="lead-name"
                    value={leadName}
                    onChange={(event) => setLeadName(event.target.value)}
                    maxLength={120}
                    placeholder="Use the next available lead"
                  />
                </>
              )}
              {selectedTask === "send" && (
                <p className={styles.safetyNote}>
                  <ShieldCheck aria-hidden="true" />
                  Sender is dry-run only here. No email will be sent.
                </p>
              )}
              {submitError && <p className={styles.formError} role="alert">{submitError}</p>}
              <button className={styles.submitButton} type="submit" disabled={submitting}>
                <span>{submitting ? "Submitting…" : "Submit task"}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
              <p className={styles.dispatchFootnote}>Tasks enter the persistent queue and run one at a time.</p>
            </form>
          </section>
        </section>

        <section className={styles.teamSection} aria-labelledby="team-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>THE OFFICE</p>
              <h2 id="team-title">A team at work <span>8 people · live task status</span></h2>
            </div>
            <div className={styles.teamLegend}><span /> Connected to task history</div>
          </div>
          <p className={styles.referenceNotice}>
            The layout reference informed the room arrangement only. Character reference portraits were not found in <code>public/brand</code>, so the team uses original vector stand-ins.
          </p>
          <div className={styles.officeFloorViewport} aria-label="Office floor. Scroll horizontally on small screens.">
            <OfficeFloor
              tasks={tasks}
              selectedStaffId={selectedStaffId}
              onSelectStaff={chooseStaff}
              onHoverStaff={setHoveredStaffId}
              connection={connection}
              floorMode={floorMode}
              floorCue={floorCue}
            />
          </div>
          <aside className={styles.staffDetail} aria-live="polite" aria-label={`${displayedStaff.name} details`}>
            <div className={styles.staffDetailHeading}>
              <div>
                <p className={styles.kicker}>EMPLOYEE PROFILE</p>
                <h3>{displayedStaff.name}</h3>
                <p>{displayedStaff.title}</p>
              </div>
              <span className={`${styles.statusPill} ${
                displayedStaffStatusTask
                  ? STATUS_CLASSES[displayedStaffStatusTask.status]
                  : styles.statusIdle
              }`}>
                {displayedStaffStatus}
              </span>
            </div>
            <div className={styles.staffDetailBody}>
              <div className={styles.staffResponsibilities}>
                <span className={styles.kicker}>RESPONSIBILITIES</span>
                <p>{displayedStaff.responsibilities}</p>
                {displayedStaff.id === "zainab" && (
                  <p className={styles.staffSafetyNote}><ShieldCheck aria-hidden="true" /> Sender is dry-run only. No live-send path is available.</p>
                )}
              </div>
              <div className={styles.staffHistory}>
                <span className={styles.kicker}>REAL TASK HISTORY</span>
                {displayedStaffHistory.length === 0 ? (
                  <p className={styles.staffHistoryEmpty}>No recorded tasks for this employee yet.</p>
                ) : (
                  <ul>
                    {displayedStaffHistory.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          className={styles.staffHistoryButton}
                          onClick={() => chooseTask(task.id)}
                        >
                          <span>
                            <strong>{TASK_LABELS[task.task]}</strong>
                            <small>{task.lead_name || formatDateTime(task.created_at)}</small>
                          </span>
                          <span className={`${styles.statusPill} ${STATUS_CLASSES[task.status]}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className={styles.lowerGrid} aria-label="Task history and activity">
          <section className={styles.historyPanel} aria-labelledby="history-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>PERSISTED IN SQLITE</p>
                <h2 id="history-title">Task history</h2>
              </div>
              <span className={styles.countBadge}>{tasks.length} recent</span>
            </div>
            {loading ? (
              <p className={styles.emptyState}>Loading task history…</p>
            ) : tasks.length === 0 ? (
              <p className={styles.emptyState}>No tasks yet. Submit one above to get started.</p>
            ) : (
              <div className={styles.historyList}>
                {tasks.slice(0, 12).map((task) => (
                  <button
                    className={`${styles.historyRow} ${selectedTaskId === task.id ? styles.historySelected : ""}`}
                    key={task.id}
                    type="button"
                    onClick={() => chooseTask(task.id)}
                    aria-pressed={selectedTaskId === task.id}
                  >
                    <span className={styles.historyIcon}>{stateIcon(task.status)}</span>
                    <span className={styles.historyName}>
                      <strong>{TASK_LABELS[task.task]}</strong>
                      <small>{displayTaskName(task.task)} · {formatTime(task.created_at)}</small>
                    </span>
                    <span className={`${styles.statusPill} ${STATUS_CLASSES[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedDetail?.error && (
              <div className={styles.taskError} role="alert">
                <strong>Task error</strong>
                <p>{selectedDetail.error}</p>
              </div>
            )}
            {selectedDetail?.result?.dry_run === true && (
              <p className={styles.resultNote}><ShieldCheck aria-hidden="true" /> Sender completed in dry-run mode.</p>
            )}
          </section>

          <section className={styles.activityPanel} aria-labelledby="activity-title">
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.kicker}>SERVER-SENT EVENTS</p>
                <h2 id="activity-title">Live activity</h2>
              </div>
              <span className={styles.eventIcon}><Activity aria-hidden="true" /></span>
            </div>
            {events.length === 0 ? (
              <p className={styles.emptyState}>
                {connection === "connected" ? "Waiting for task activity." : "Activity will appear when the backend connects."}
              </p>
            ) : (
              <ol className={styles.activityList} aria-live="polite" aria-relevant="additions">
                {events.slice(0, 12).map((event) => {
                  const relatedTask = tasks.find((task) => task.id === event.task_id);
                  return (
                    <li className={styles.activityItem} key={event.id}>
                      <span className={styles.activityDot} aria-hidden="true" />
                      <div className={styles.activityBody}>
                        <strong>{relatedTask ? displayTaskName(relatedTask.task) : "Office task"}</strong>
                        <p>{event.message}</p>
                        <small>{formatTime(event.created_at)} · {event.type}</small>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className={styles.activityFooter}>
              <UsersRound aria-hidden="true" />
              <span>Activity is sourced from persisted task events.</span>
            </div>
          </section>
        </section>

        <section className={styles.workspaceSection} aria-labelledby="prospects-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>SQLITE WORKSPACE</p>
              <h2 id="prospects-title">Prospects <span>{prospects.length} records</span></h2>
            </div>
            <div className={styles.workspaceActions}>
              <button
                className={styles.workspaceButton}
                type="button"
                onClick={() => void refreshProspects()}
                disabled={prospectLoading}
              >
                <RefreshCw aria-hidden="true" /> Refresh
              </button>
              <button
                className={styles.workspaceButton}
                type="button"
                onClick={() => setProspectFormOpen((open) => !open)}
                aria-expanded={prospectFormOpen}
                aria-controls="prospect-create-form"
              >
                <Plus aria-hidden="true" /> Add prospect
              </button>
              <button
                className={styles.workspaceButton}
                type="button"
                onClick={() => exportProspects("csv")}
                disabled={prospectLoading || Boolean(prospectError)}
              >
                <Download aria-hidden="true" /> CSV
              </button>
              <button
                className={styles.workspaceButton}
                type="button"
                onClick={() => exportProspects("json")}
                disabled={prospectLoading || Boolean(prospectError)}
              >
                <Download aria-hidden="true" /> JSON
              </button>
            </div>
          </div>

          {prospectError && (
            <div className={styles.workspaceError} role="alert">
              <strong>Could not load prospects</strong><span>{prospectError}</span>
            </div>
          )}
          {prospectActionError && <p className={styles.workspaceError} role="alert">{prospectActionError}</p>}
          {prospectFeedback && <p className={styles.workspaceFeedback} role="status">{prospectFeedback}</p>}

          {prospectFormOpen && (
            <form
              className={styles.createForm}
              id="prospect-create-form"
              onSubmit={createProspect}
            >
              <div className={styles.formHeading}>
                <div><strong>Add a prospect</strong><span>Saved to the local SQLite workspace.</span></div>
                <button
                  className={styles.workspaceButton}
                  type="button"
                  onClick={() => setProspectFormOpen(false)}
                  disabled={prospectSaving}
                >
                  Cancel
                </button>
              </div>
              <div className={styles.formFields}>
                <label className={styles.workspaceField}>
                  Business name
                  <input name="name" required maxLength={120} autoComplete="organization" />
                </label>
                <label className={styles.workspaceField}>
                  Category
                  <input name="category" required maxLength={80} />
                </label>
                <label className={styles.workspaceField}>
                  City
                  <input name="city" required maxLength={120} autoComplete="address-level2" />
                </label>
                <label className={styles.workspaceField}>
                  Email <span>Optional</span>
                  <input name="email" type="email" maxLength={254} autoComplete="email" />
                </label>
                <label className={styles.workspaceField}>
                  Phone <span>Optional</span>
                  <input name="phone" maxLength={40} autoComplete="tel" />
                </label>
                <label className={styles.workspaceField}>
                  Website URL <span>Optional</span>
                  <input name="website_url" type="url" maxLength={2048} placeholder="https://" />
                </label>
              </div>
              <button className={styles.workspacePrimaryButton} type="submit" disabled={prospectSaving}>
                {prospectSaving ? "Saving…" : "Save prospect"}
              </button>
            </form>
          )}

          <div className={styles.workspaceGrid}>
            <section className={styles.recordPanel} aria-label="Saved prospects">
              <div className={styles.recordControls}>
                <label className={styles.searchField}>
                  <Search aria-hidden="true" />
                  <span className={styles.srOnly}>Search prospects</span>
                  <input
                    value={prospectSearch}
                    onChange={(event) => setProspectSearch(event.target.value)}
                    placeholder="Search name, category, city, email…"
                  />
                </label>
                <label className={styles.srOnly} htmlFor="prospect-status-filter">Filter prospects by status</label>
                <select
                  className={styles.recordFilter}
                  id="prospect-status-filter"
                  value={prospectStatusFilter}
                  onChange={(event) => setProspectStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {Object.entries(PROSPECT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <p className={styles.recordCount} aria-live="polite">
                Showing {filteredProspects.length} of {prospects.length} prospects
              </p>
              {prospectLoading ? (
                <p className={styles.emptyState}>Loading prospects…</p>
              ) : filteredProspects.length === 0 ? (
                <p className={styles.emptyState}>
                  {prospects.length ? "No prospects match these filters." : "No prospects are available."}
                </p>
              ) : (
                <div className={styles.recordList}>
                  {filteredProspects.map((prospect) => (
                    <article
                      className={`${styles.recordRow} ${
                        selectedProspect?.id === prospect.id ? styles.recordRowSelected : ""
                      }`}
                      key={prospect.id}
                    >
                      <button
                        className={styles.recordChoice}
                        type="button"
                        onClick={() => setSelectedProspectId(prospect.id)}
                        aria-pressed={selectedProspect?.id === prospect.id}
                      >
                        <span className={styles.recordIdentity}>
                          <Building2 aria-hidden="true" />
                          <span>
                            <strong>{prospect.name}{prospect.isDemo && <small>DEMO</small>}</strong>
                            <span>{prospect.category} · {prospect.city}</span>
                          </span>
                        </span>
                        <span className={styles.recordSubline}>
                          {prospect.email || prospect.phone || "No contact details"} · score {prospect.score}
                        </span>
                      </button>
                      <label className={styles.srOnly} htmlFor={`prospect-status-${prospect.id}`}>
                        Status for {prospect.name}
                      </label>
                      <select
                        className={`${styles.recordStatusSelect} ${styles[`prospectStatus_${prospect.status.replace("-", "_")}`]}`}
                        id={`prospect-status-${prospect.id}`}
                        value={prospect.status}
                        disabled={updatingProspectId === prospect.id}
                        onChange={(event) => {
                          if (isProspectStatus(event.target.value)) {
                            void updateProspectStatus(prospect.id, event.target.value);
                          }
                        }}
                      >
                        {Object.entries(PROSPECT_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className={styles.detailPanel} aria-label="Selected prospect details">
              {!selectedProspect ? (
                <p className={styles.emptyState}>Choose a prospect to view its details.</p>
              ) : (
                <>
                  <div className={styles.detailHeading}>
                    <span className={styles.detailAvatar}><Building2 aria-hidden="true" /></span>
                    <div>
                      <p className={styles.kicker}>PROSPECT DETAILS</p>
                      <h3>{selectedProspect.name}</h3>
                      <span>{selectedProspect.category} · {selectedProspect.city}</span>
                    </div>
                  </div>
                  {selectedProspect.isDemo && (
                    <p className={styles.dataNotice}>
                      Fictional sample record. Business and contact details are illustrative.
                    </p>
                  )}
                  <dl className={styles.detailList}>
                    <div><dt><Mail aria-hidden="true" /> Email</dt><dd>{selectedProspect.email || "Not provided"}</dd></div>
                    <div><dt><Phone aria-hidden="true" /> Phone</dt><dd>{selectedProspect.phone || "Not provided"}</dd></div>
                    <div>
                      <dt><Globe aria-hidden="true" /> Website</dt>
                      <dd>{selectedProspect.website || (
                        selectedProspect.hasWebsite === null ? "Unknown — not verified" : "Not provided"
                      )}</dd>
                    </div>
                    <div><dt><MapPin aria-hidden="true" /> City</dt><dd>{selectedProspect.city}</dd></div>
                    <div><dt>Lead score</dt><dd>{selectedProspect.score} · local value</dd></div>
                    <div><dt>Status</dt><dd>{PROSPECT_STATUS_LABELS[selectedProspect.status]}</dd></div>
                  </dl>
                  <div className={styles.recordActivity}>
                    <h4>Record activity</h4>
                    {prospectActivityLoading ? (
                      <p className={styles.activityMessage}>Loading recorded activity…</p>
                    ) : prospectActivityError ? (
                      <p className={styles.workspaceError} role="alert">{prospectActivityError}</p>
                    ) : prospectActivities.length > 0 ? (
                      <ol>
                        {prospectActivities.map((activity) => (
                          <li key={activity.id}>
                            <span />
                            <div>
                              <strong>{prospectActivityLabel(activity)}</strong>
                              <time dateTime={activity.createdAt}>
                                {formatDateTime(activity.createdAt)}
                              </time>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className={styles.activityMessage}>
                        No events have been recorded for this prospect yet. Older history was not backfilled.
                      </p>
                    )}
                  </div>
                </>
              )}
            </aside>
          </div>
        </section>

        <section className={styles.workspaceSection} aria-labelledby="leads-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>SCRIPT LEAD FILES</p>
              <h2 id="leads-title">Lead records <span>{leads.length} records</span></h2>
            </div>
            <div className={styles.workspaceActions}>
              <button
                className={styles.workspaceButton}
                type="button"
                onClick={() => void refreshLeads()}
                disabled={leadsLoading}
              >
                <RefreshCw aria-hidden="true" /> Refresh
              </button>
              <button
                className={styles.workspaceButton}
                type="button"
                onClick={() => exportLeads("csv")}
                disabled={leadsLoading || Boolean(leadsError)}
              >
                <Download aria-hidden="true" /> CSV
              </button>
              <button
                className={styles.workspaceButton}
                type="button"
                onClick={() => exportLeads("json")}
                disabled={leadsLoading || Boolean(leadsError)}
              >
                <Download aria-hidden="true" /> JSON
              </button>
            </div>
          </div>
          <p className={styles.workspaceDescription}>
            These records come from the existing lead-generation files, separate from saved SQLite prospects.
          </p>
          {leadsError && (
            <div className={styles.workspaceError} role="alert">
              <strong>Could not load leads</strong><span>{leadsError}</span>
            </div>
          )}
          {leadActionError && <p className={styles.workspaceError} role="alert">{leadActionError}</p>}
          {leadFeedback && <p className={styles.workspaceFeedback} role="status">{leadFeedback}</p>}
          <div className={styles.workspaceGrid}>
            <section className={styles.recordPanel} aria-label="Script lead records">
              <div className={styles.recordControls}>
                <label className={styles.searchField}>
                  <Search aria-hidden="true" />
                  <span className={styles.srOnly}>Search leads</span>
                  <input
                    value={leadSearch}
                    onChange={(event) => setLeadSearch(event.target.value)}
                    placeholder="Search business, email, phone…"
                  />
                </label>
                <label className={styles.srOnly} htmlFor="lead-status-filter">Filter leads by status</label>
                <select
                  className={styles.recordFilter}
                  id="lead-status-filter"
                  value={leadStatusFilter}
                  onChange={(event) => setLeadStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <p className={styles.recordCount} aria-live="polite">
                Showing {filteredLeads.length} of {leads.length} leads
              </p>
              {leadsLoading ? (
                <p className={styles.emptyState}>Loading lead records…</p>
              ) : filteredLeads.length === 0 ? (
                <p className={styles.emptyState}>
                  {leads.length ? "No leads match these filters." : "No script leads are available."}
                </p>
              ) : (
                <div className={styles.recordList}>
                  {filteredLeads.map((lead) => (
                    <article
                      className={`${styles.recordRow} ${
                        selectedLead?.name === lead.name ? styles.recordRowSelected : ""
                      }`}
                      key={`${lead.name}:${lead.email}`}
                    >
                      <button
                        className={styles.recordChoice}
                        type="button"
                        onClick={() => setSelectedLeadName(lead.name)}
                        aria-pressed={selectedLead?.name === lead.name}
                      >
                        <span className={styles.recordIdentity}>
                          <Building2 aria-hidden="true" />
                          <span>
                            <strong>{lead.name}</strong>
                            <span>{lead.email || "No email found"}</span>
                          </span>
                        </span>
                        <span className={styles.recordSubline}>
                          {lead.phone || lead.website || "No phone or website"} · score {lead.score ?? "—"}
                        </span>
                      </button>
                      <span className={`${styles.leadStatus} ${styles[`leadStatus_${lead.status.replace("-", "_")}`]}`}>
                        {LEAD_STATUS_LABELS[lead.status]}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <aside className={styles.detailPanel} aria-label="Selected lead details">
              {!selectedLead ? (
                <p className={styles.emptyState}>Choose a lead to view its details.</p>
              ) : (
                <>
                  <div className={styles.detailHeading}>
                    <span className={styles.detailAvatar}><Building2 aria-hidden="true" /></span>
                    <div>
                      <p className={styles.kicker}>LEAD DETAILS</p>
                      <h3>{selectedLead.name}</h3>
                      <span className={`${styles.leadStatus} ${styles[`leadStatus_${selectedLead.status.replace("-", "_")}`]}`}>
                        {LEAD_STATUS_LABELS[selectedLead.status]}
                      </span>
                    </div>
                  </div>
                  <dl className={styles.detailList}>
                    <div><dt><Mail aria-hidden="true" /> Email</dt><dd>{selectedLead.email || "Not found"}</dd></div>
                    {selectedLead.all_emails.filter((email) => email !== selectedLead.email).length > 0 && (
                      <div>
                        <dt>Other emails</dt>
                        <dd>{selectedLead.all_emails.filter((email) => email !== selectedLead.email).join(", ")}</dd>
                      </div>
                    )}
                    <div><dt><Phone aria-hidden="true" /> Phone</dt><dd>{selectedLead.phone || "Not provided"}</dd></div>
                    <div><dt><Globe aria-hidden="true" /> Website</dt><dd>{selectedLead.website || "Not provided"}</dd></div>
                    <div><dt><MapPin aria-hidden="true" /> Address</dt><dd>{selectedLead.address || "Not provided"}</dd></div>
                    <div><dt>Lead score</dt><dd>{selectedLead.score ?? "Not scored"}</dd></div>
                    <div><dt>Sent record</dt><dd>{selectedLead.sent_at ? formatDateTime(selectedLead.sent_at) : "No sent timestamp"}</dd></div>
                  </dl>
                  <div className={styles.leadSafety}>
                    <ShieldCheck aria-hidden="true" />
                    <p>Opt-out updates the local suppression list only. This dashboard never sends email.</p>
                  </div>
                  <button
                    className={styles.optOutButton}
                    type="button"
                    onClick={() => void optOutLead(selectedLead)}
                    disabled={
                      !selectedLead.email ||
                      selectedLead.status === "opted-out" ||
                      optingOutEmail === selectedLead.email
                    }
                  >
                    {optingOutEmail === selectedLead.email
                      ? "Saving opt-out…"
                      : selectedLead.status === "opted-out"
                        ? "Already opted out"
                        : "Add email to opt-out list"}
                  </button>
                  <PitchDraftEditor
                    key={`lead-${selectedLead.name}`}
                    leadName={selectedLead.name}
                    email={selectedLead.email}
                    initialSubject=""
                    initialBody=""
                    revision={pitchDraftRevision}
                    onSaved={() => setPitchDraftRevision((revision) => revision + 1)}
                  />
                </>
              )}
            </aside>
          </div>
        </section>

        {selectedDetail && (
          <section className={styles.taskDetails} aria-labelledby="selected-task-details">
            <h2 className={styles.taskDetailsHeading} id="selected-task-details">
              Selected task details <span>#{selectedDetail.id.slice(0, 8)}</span>
            </h2>
            <dl>
              <div><dt>Started</dt><dd>{formatTime(selectedDetail.started_at)}</dd></div>
              <div><dt>Completed</dt><dd>{formatTime(selectedDetail.completed_at)}</dd></div>
              <div><dt>Exit code</dt><dd>{selectedDetail.exit_code ?? "—"}</dd></div>
              {selectedDetail.result?.dry_run === true && (
                <div><dt>Execution mode</dt><dd>Dry-run only</dd></div>
              )}
            </dl>
            {taskPitch && (
              <PitchDraftEditor
                key={`task-${selectedDetail.id}`}
                leadName={taskPitch.name}
                email=""
                initialSubject={taskPitch.subject}
                initialBody={taskPitch.body}
                sourceTaskId={selectedDetail.id}
                revision={pitchDraftRevision}
                onSaved={() => setPitchDraftRevision((revision) => revision + 1)}
              />
            )}
          </section>
        )}

        <footer className={styles.footer}>
          <span>AI Khan Virtual Office</span>
          <span><ShieldCheck aria-hidden="true" /> Local backend · no public task access</span>
          <Link href="/office">AI Khan Command Center <ArrowUpRight aria-hidden="true" /></Link>
        </footer>
      </div>
    </main>
  );
}
