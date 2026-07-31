import type { InvoiceStatus, JobStatus, SyncJobStatus } from "@/generated/prisma/enums";

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
  DONE_NOT_INVOICED: "Done, not invoiced",
  INVOICED: "Invoiced",
  DISMISSED: "Dismissed",
};

export const syncJobStatusLabel: Record<SyncJobStatus, string> = {
  PENDING: "Retrying",
  RUNNING: "Syncing",
  FAILED: "Failed",
  SUCCEEDED: "Synced",
};
