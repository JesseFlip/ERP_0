/**
 * Every valid status transition in the app, in one place. Routers call these
 * guards instead of inlining status comparisons, so the full state machine
 * for a Job/Estimate/Invoice is readable (and testable) without having to
 * hunt across trpc procedures for every `if (status !== ...)` check.
 */
import type { EstimateStatus, InvoiceStatus, JobStatus } from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Job — SCHEDULED -> IN_PROGRESS -> DONE_NOT_INVOICED -> INVOICED
//                                 \-> DISMISSED (only from DONE_NOT_INVOICED)
// ---------------------------------------------------------------------------

export function canStartJob(status: JobStatus) {
  return status === "SCHEDULED";
}

export function canCompleteJob(status: JobStatus) {
  return status === "SCHEDULED" || status === "IN_PROGRESS";
}

export function canDismissJob(status: JobStatus) {
  return status === "DONE_NOT_INVOICED";
}

/** Planned/change-order lines are editable any time before the job is invoiced. */
export function canEditJobLines(status: JobStatus) {
  return status !== "INVOICED";
}

/** Only jobs sitting in the uninvoiced queue can be turned into an invoice. */
export function canCreateInvoiceFromJob(status: JobStatus) {
  return status === "DONE_NOT_INVOICED";
}

// ---------------------------------------------------------------------------
// Estimate — DRAFT -> SENT -> ACCEPTED -> (converts to a Job)
//                          \-> DECLINED
// ---------------------------------------------------------------------------

export function canEditEstimate(status: EstimateStatus) {
  return status === "DRAFT";
}

export function canSendEstimate(status: EstimateStatus) {
  return status === "DRAFT";
}

export function canRespondToEstimate(status: EstimateStatus) {
  return status === "SENT";
}

export function canConvertEstimateToJob(status: EstimateStatus) {
  return status === "ACCEPTED";
}

// ---------------------------------------------------------------------------
// Invoice — DRAFT -> NOT_POSTED -> POSTED -> SENT -> VIEWED -> PAID
// ---------------------------------------------------------------------------

export function canEditInvoiceLines(status: InvoiceStatus) {
  return status === "DRAFT";
}

export function canFinalizeInvoice(status: InvoiceStatus) {
  return status === "DRAFT";
}

/** Retrying a QBO push only makes sense once the invoice has left DRAFT. */
export function canRetrySyncInvoice(status: InvoiceStatus) {
  return status !== "DRAFT";
}
