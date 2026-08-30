/**
 * View models for the UI-only phase.
 *
 * These mirror db/migrations/00002_enums.sql verbatim so that the screens are built
 * against the real vocabulary. They are NOT the API types: once
 * `docs/api/openapi.yaml` generates a client into `lib/api/`, every import of this
 * module is replaced by the generated type and this file is deleted. Nothing here is
 * hand-written twice — that is the whole point of the spec being the contract.
 */

export type ContextKind = "work" | "study" | "personal"

export type AccountProvider =
  | "gmail"
  | "gcalendar"
  | "gdrive"
  | "zalo_oa"
  | "facebook_page"
  | "instagram_business"
  | "manual"

export type AccountReliability = "official" | "unofficial" | "manual"
export type AccountStatus = "active" | "needs_reauth" | "disabled" | "error"

export type SignalKind = "email" | "message" | "calendar_event" | "file" | "note"
export type SignalDirection = "inbound" | "outbound" | "internal"
export type AssignmentSource = "rule" | "model" | "manual"

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "dropped"
export type TaskOwner = "me" | "agent"
export type EventStatus = "confirmed" | "tentative" | "cancelled"
export type CommitmentDirection = "i_owe" | "owed_to_me"
export type CommitmentStatus = "open" | "fulfilled" | "waived" | "dropped"

export type ActionRisk = "low" | "medium" | "high"
export type AutonomyLevel = "ask" | "draft" | "auto"
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"
export type ProposedActionStatus =
  | "pending"
  | "approved"
  | "edited"
  | "rejected"
  | "expired"
export type AuditActor = "user" | "agent" | "system"
export type ReportKind = "session" | "daily" | "weekly"

export interface Context {
  id: string
  parentId: string | null
  slug: string
  name: string
  kind: ContextKind
  toneProfile: string
  activeHours: string
}

export interface Account {
  id: string
  provider: AccountProvider
  displayName: string
  reliability: AccountReliability
  status: AccountStatus
  lastSyncAt: string | null
  lastError: string | null
  contextIds: string[]
}

export interface Person {
  id: string
  displayName: string
  handle: string
}

export interface Signal {
  id: string
  accountId: string
  kind: SignalKind
  direction: SignalDirection
  from: string
  subject: string
  preview: string
  occurredAt: string
  contextId: string | null
  confidence: number | null
  assignedBy: AssignmentSource | null
}

export interface Task {
  id: string
  contextId: string
  title: string
  detail: string
  status: TaskStatus
  owner: TaskOwner
  /** 1 = highest. Matches `tasks_priority_range`. */
  priority: number
  dueAt: string | null
  estimatedMinutes: number | null
  sourceSignalId: string | null
  blockedReason: string | null
}

export interface WorkEvent {
  id: string
  contextId: string
  title: string
  startAt: string
  endAt: string | null
  location: string | null
  status: EventStatus
  personId: string | null
  sourceSignalId: string | null
}

export interface Commitment {
  id: string
  contextId: string
  personId: string
  direction: CommitmentDirection
  what: string
  promisedAt: string
  dueAt: string | null
  status: CommitmentStatus
  evidenceSignalId: string
}

export interface ProposedAction {
  id: string
  runId: string
  contextId: string
  kind: "send_email" | "send_message" | "create_event" | "update_record"
  risk: ActionRisk
  status: ProposedActionStatus
  recipient: string
  subject: string
  body: string
  /** Non-null once the owner rewrites the draft — the divergence worth training on. */
  bodyEdited: string | null
  autonomyLevelApplied: AutonomyLevel
  createdAt: string
}

export interface Run {
  id: string
  sessionId: string
  taskId: string | null
  actionType: string
  contextId: string
  status: RunStatus
  model: string
  tokensIn: number
  tokensOut: number
  startedAt: string
  endedAt: string | null
  error: string | null
}

export interface WorkSession {
  id: string
  contextIds: string[]
  startedAt: string
  endedAt: string | null
  tokensIn: number
  tokensOut: number
  actionsProposed: number
  actionsApproved: number
}

export interface AuditEntry {
  id: string
  entityType: string
  entityId: string
  action: string
  actor: AuditActor
  contextId: string | null
  summary: string
  diff: Array<{ field: string; before: string | null; after: string | null }>
  createdAt: string
}

export interface Report {
  id: string
  kind: ReportKind
  sessionId: string | null
  periodStart: string
  periodEnd: string
  generatedAt: string
  contextIds: string[]
  /** Sources that were degraded over the period. A report never hides this. */
  degradedAccountIds: string[]
  done: string[]
  waiting: string[]
  blocked: string[]
  dueNext: string[]
}

export interface AutonomyRule {
  contextId: string
  actionType: string
  risk: ActionRisk
  level: AutonomyLevel
  /** Consecutive `approved_unchanged` outcomes accumulated so far. */
  evidenceClean: number
  evidenceThreshold: number
  updatedAt: string
}
