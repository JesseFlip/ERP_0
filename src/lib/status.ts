import type { EstimateStatus, InvoiceStatus, JobStatus, SyncJobStatus } from "@/generated/prisma/enums";

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  NOT_POSTED: "Not posted",
  POSTED: "Posted",
  SENT: "Sent",
  VIEWED: "Viewed",
  PAID: "Paid",
};

export const invoiceStatusVariant: Record<InvoiceStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  NOT_POSTED: "danger",
  POSTED: "info",
  SENT: "info",
  VIEWED: "warning",
  PAID: "success",
};

export const jobStatusLabel: Record<JobStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  DONE_NOT_INVOICED: "Done, not invoiced",
  INVOICED: "Invoiced",
  DISMISSED: "Dismissed",
};

export const jobStatusVariant: Record<JobStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  SCHEDULED: "info",
  IN_PROGRESS: "warning",
  DONE_NOT_INVOICED: "warning",
  INVOICED: "success",
  DISMISSED: "neutral",
};

export const syncJobStatusLabel: Record<SyncJobStatus, string> = {
  PENDING: "Retrying",
  RUNNING: "Syncing",
  FAILED: "Failed",
  SUCCEEDED: "Synced",
};

export const estimateStatusLabel: Record<EstimateStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

export const estimateStatusVariant: Record<EstimateStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  DECLINED: "danger",
};
