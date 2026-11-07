"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
type StaffId = "azhar" | "khan" | "ali" | "ayesha" | "hassan" | "sara" | "usman" | "zainab";
type PoseName = "sit" | "stand" | "walk" | "angry" | "success" | "talk";

type OfficeTask = {
  id: string;
  task: TaskType;
  status: TaskStatus;
  created_at: string;
};

type OfficeStaff = {
  id: StaffId;
  name: string;
  title: string;
  task: TaskType | null;
};

type FloorCue = {
  kind: "recall" | "success";
  message: string;
  taskId: string;
  staffId?: StaffId;
  sequence: number;
};

type Props = {
  tasks: OfficeTask[];
  staff: OfficeStaff[];
  selectedStaffId: StaffId;
  onSelectStaff: (id: StaffId) => void;
  onHoverStaff: (id: StaffId | null) => void;
  connection: "connecting" | "connected" | "reconnecting" | "offline";
  floorMode: "desks" | "lounge";
  floorCue: FloorCue | null;
  azharPlaceholder: boolean;
  fallback: ReactNode;
};

const TASK_LABELS: Record<TaskType, string> = {
  discover: "Discover",
  emails: "Email Hunter",
  score: "Scoring",
  pitch: "Pitch",
  import: "Importer",
  send: "Sender · dry-run only",
};

const TERMINAL_STATUSES = new Set<TaskStatus>([
  "completed",
  "failed",
  "timed_out",
  "interrupted",
]);

const DESK_POSITIONS: Record<StaffId, { x: number; y: number }> = {
  azhar: { x: 52, y: 21 },
  khan: { x: 20, y: 80 },
  ali: { x: 20, y: 41 },
  ayesha: { x: 20, y: 52 },
  hassan: { x: 20, y: 63 },
  sara: { x: 80, y: 41 },
  usman: { x: 80, y: 52 },
  zainab: { x: 80, y: 63 },
};

const LOUNGE_POSITIONS: Record<Exclude<StaffId, "azhar" | "khan">, { x: number; y: number }> = {
  ali: { x: 34, y: 41 },
  ayesha: { x: 50, y: 41 },
  hassan: { x: 66, y: 41 },
  sara: { x: 34, y: 61 },
  usman: { x: 50, y: 61 },
  zainab: { x: 66, y: 61 },
};

const POSES: Record<StaffId, Record<PoseName, string>> = {
  azhar: {
    sit: "azhar/azhar-sit.png",
    stand: "azhar/azhar-stand.png",
    walk: "azhar/azhar-walk.png",
    angry: "azhar/azhar-angry.png",
    success: "azhar/azhar-success.png",
    talk: "azhar/azhar-talk.png",
  },
  khan: {
    sit: "khan/khan-10.png",
    stand: "khan/khan-10.png",
    walk: "khan/khan-10.png",
    angry: "khan/khan-06.png",
    success: "khan/khan-01.png",
    talk: "khan/khan-12.png",
  },
  ali: {
    sit: "ali/ali-20.png",
    stand: "ali/ali-02.png",
    walk: "ali/ali-08.png",
    angry: "ali/ali-02.png",
    success: "ali/ali-02.png",
    talk: "ali/ali-21.png",
  },
  ayesha: {
    sit: "ayesha/ayesha-13.png",
    stand: "ayesha/ayesha-02.png",
    walk: "ayesha/ayesha-07.png",
    angry: "ayesha/ayesha-19.png",
    success: "ayesha/ayesha-20.png",
    talk: "ayesha/ayesha-30.png",
  },
  hassan: {
    sit: "hassan/hassan-20.png",
    stand: "hassan/hassan-02.png",
    walk: "hassan/hassan-08.png",
    angry: "hassan/hassan-02.png",
    success: "hassan/hassan-02.png",
    talk: "hassan/hassan-21.png",
  },
  sara: {
    sit: "sara/sara-13.png",
    stand: "sara/sara-02.png",
    walk: "sara/sara-07.png",
    angry: "sara/sara-22.png",
    success: "sara/sara-19.png",
    talk: "sara/sara-30.png",
  },
  usman: {
    sit: "usman/usman-13.png",
    stand: "usman/usman-02.png",
    walk: "usman/usman-08.png",
    angry: "usman/usman-17.png",
    success: "usman/usman-20.png",
    talk: "usman/usman-22.png",
  },
  zainab: {
    sit: "zainab/zainab-13.png",
    stand: "zainab/zainab-02.png",
    walk: "zainab/zainab-07.png",
    angry: "zainab/zainab-18.png",
    success: "zainab/zainab-17.png",
    talk: "zainab/zainab-21.png",
  },
};

const POSE_BASE = "/office/processed-pixel/";

function latestTaskFor(tasks: OfficeTask[], taskType: TaskType): OfficeTask | null {
  return tasks.find((task) => task.task === taskType) ?? null;
}

function statusColor(status: TaskStatus | null, alert: boolean, unavailable: boolean): string {
  if (unavailable) return "#687b76";
  if (alert || status === "failed" || status === "timed_out") return "#a83b45";
  if (status === "queued") return "#8a5a16";
  if (status === "assigned") return "#326179";
  if (status === "running" || status === "completed") return "#147451";
  if (status === "interrupted") return "#8a5a16";
  return "#687b76";
}

export default function OfficeSpriteScene({
  tasks,
  staff,
  selectedStaffId,
  onSelectStaff,
  onHoverStaff,
  connection,
  floorMode,
  floorCue,
  azharPlaceholder,
  fallback,
}: Props) {
  const [imageError, setImageError] = useState("");
  const [walking, setWalking] = useState(false);
  const previousFloorMode = useRef(floorMode);

  const recentTasks = useMemo(
    () => [...tasks].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at)),
    [tasks],
  );
  const activeTask = recentTasks.find((task) => !TERMINAL_STATUSES.has(task.status)) ?? null;

  useEffect(() => {
    if (previousFloorMode.current === floorMode) return;
    previousFloorMode.current = floorMode;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWalking(false);
      return;
    }
    setWalking(true);
    const timer = window.setTimeout(() => setWalking(false), 1_150);
    return () => window.clearTimeout(timer);
  }, [floorMode]);

  if (imageError) {
    return (
      <div className={styles.officeSpriteFallback} role="alert">
        <p>Could not load {imageError}. Showing the existing office floor fallback.</p>
        {fallback}
      </div>
    );
  }

  return (
    <div
      className={styles.officeSpriteScene}
      role="group"
      aria-label="AI Khan Virtual Office with eight interactive characters and live task statuses"
    >
      <Image
        className={styles.officeSpriteBackground}
        src="/office/processed/office-bg-clean.png"
        alt=""
        fill
        priority
        sizes="(max-width: 900px) 900px, 100vw"
        onError={() => setImageError("/office/processed/office-bg-clean.png")}
      />
      {staff.map((employee) => {
        const deskPosition = DESK_POSITIONS[employee.id];
        const loungePosition = employee.id === "azhar" || employee.id === "khan"
          ? null
          : LOUNGE_POSITIONS[employee.id];
        const assignedTask = employee.task ? latestTaskFor(recentTasks, employee.task) : null;
        const employeeTask = assignedTask && !TERMINAL_STATUSES.has(assignedTask.status)
          ? assignedTask
          : null;
        const errorCue = floorCue?.kind === "recall" && employee.id === "khan";
        const taskError = assignedTask && (
          assignedTask.status === "failed" ||
          assignedTask.status === "timed_out" ||
          assignedTask.status === "interrupted"
        );
        const unavailable = connection !== "connected";
        const inLounge = employee.id !== "khan" && floorMode === "lounge" && loungePosition !== null;
        const position = inLounge ? loungePosition : deskPosition;
        const successPose = floorCue?.kind === "success" && floorCue.staffId === employee.id;
        let currentStatus: string;
        if (unavailable) {
          currentStatus = "Status unavailable · backend offline";
        } else if (employee.id === "azhar") {
          currentStatus = activeTask ? `Working · team ${activeTask.status}` : "Idle · no active task";
        } else if (employee.id === "khan") {
          currentStatus = errorCue
            ? "Alert · team recalled"
            : activeTask
              ? `Coordinating · ${activeTask.status}`
              : "Idle · awaiting command";
        } else if (employeeTask) {
          currentStatus = `${employeeTask.status === "running" ? "Working" : employeeTask.status} · ${TASK_LABELS[employeeTask.task]}`;
        } else if (taskError && !inLounge) {
          currentStatus = `Alert · last run ${assignedTask.status}`;
        } else if (assignedTask) {
          currentStatus = `Idle · last run ${assignedTask.status}`;
        } else {
          currentStatus = inLounge ? "Idle · in lounge" : "Idle · no assigned task";
        }
        const status = unavailable
          ? null
          : employeeTask?.status ??
            (errorCue || (taskError && !inLounge) ? assignedTask?.status ?? null : null) ??
            ((employee.id === "azhar" || employee.id === "khan") ? activeTask?.status ?? null : null);
        const isAlert = errorCue || Boolean(taskError && !inLounge);
        const isWorking = Boolean(
          employeeTask ||
          ((employee.id === "azhar" || employee.id === "khan") && activeTask),
        );
        const indicator = unavailable || isAlert ? "Alert" : isWorking ? "Working" : "Idle";
        const animateWalk = employee.id !== "khan" && walking && (
          floorCue?.kind === "recall" ||
          (floorCue?.kind === "success" && !successPose) ||
          inLounge
        );
        let statusCause: string;
        if (unavailable) {
          statusCause = "backend offline";
        } else if (errorCue) {
          statusCause = "team recalled";
        } else if (employee.id === "azhar" && activeTask) {
          statusCause = `team ${activeTask.status}`;
        } else if (employee.id === "khan" && activeTask) {
          statusCause = `coordinating ${activeTask.status}`;
        } else if (employeeTask) {
          statusCause = `${employeeTask.status} · ${TASK_LABELS[employeeTask.task]}`;
        } else if (assignedTask) {
          statusCause = `last run ${assignedTask.status}`;
        } else if (inLounge) {
          statusCause = "in lounge";
        } else if (employee.id === "khan") {
          statusCause = "awaiting command";
        } else if (employee.id === "azhar") {
          statusCause = "no active task";
        } else {
          statusCause = "no assigned task";
        }
        const pose: PoseName = errorCue
          ? "angry"
          : successPose
            ? "success"
            : employee.id === "khan"
              ? "sit"
            : animateWalk
              ? "walk"
              : employeeTask
                ? "sit"
                : inLounge
                  ? "talk"
                  : "stand";
        const posePath = `${POSE_BASE}${POSES[employee.id][pose]}`;
        const callout = floorCue && (
          (floorCue.kind === "recall" && employee.id === "khan") ||
          (floorCue.kind === "success" && floorCue.staffId === employee.id)
        );
        const ariaStatus = `${employee.name}, ${employee.title}. Current status: ${currentStatus}. ${
          employeeTask ? TASK_LABELS[employeeTask.task] : assignedTask ? `Last task: ${TASK_LABELS[assignedTask.task]}` : "No task assigned"
        }.`;

        return (
          <div
            key={employee.id}
            className={`${styles.officeSpriteCharacter} ${animateWalk ? styles.officeSpriteWalking : ""}`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              zIndex: Math.round(position.y * 10),
            }}
          >
            <button
              type="button"
              className={styles.officeSpriteHotspot}
              aria-label={ariaStatus}
              aria-pressed={selectedStaffId === employee.id}
              onClick={() => onSelectStaff(employee.id)}
              onMouseEnter={() => onHoverStaff(employee.id)}
              onMouseLeave={() => onHoverStaff(null)}
              onFocus={() => onHoverStaff(employee.id)}
              onBlur={() => onHoverStaff(null)}
            >
              <span className={styles.officeSpriteArt}>
                <Image
                  src={posePath}
                  alt=""
                  fill
                  sizes="180px"
                  className={styles.officeSpriteCharacterImage}
                  onError={() => setImageError(posePath)}
                />
              </span>
              <span className={styles.officeSpriteName}>{employee.name}</span>
              <span className={`${styles.officeSpriteIndicator} ${isAlert || unavailable ? styles.officeSpriteIndicatorAlert : isWorking ? styles.officeSpriteIndicatorWorking : ""}`}>
                {indicator} · {statusCause}
              </span>
              <span className={styles.officeSpriteTitle}>{employee.title}</span>
              <span className={styles.officeSpriteStatus}>
                <i style={{ backgroundColor: statusColor(status, isAlert, unavailable) }} aria-hidden="true" />
                {currentStatus}
              </span>
              {employee.id === "azhar" && azharPlaceholder && (
                <span className={styles.officeSpritePlaceholder}>TEMP · ALI POSE</span>
              )}
              {employee.id === "zainab" && (
                <span className={styles.officeSpriteDryRun}>SENDER · DRY-RUN ONLY</span>
              )}
            </button>
            {callout && (
              <div className={styles.officeSpriteCallout} role="status">
                {floorCue.message}
              </div>
            )}
          </div>
        );
      })}
      {floorMode === "lounge" && !floorCue && (
        <div className={styles.officeSpriteBanter} aria-hidden="true">Anyone for chai?</div>
      )}
    </div>
  );
}
