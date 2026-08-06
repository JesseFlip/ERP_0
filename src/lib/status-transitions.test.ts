import { describe, expect, it } from "vitest";
import type { EstimateStatus, InvoiceStatus, JobStatus } from "@/generated/prisma/enums";
import {
  canCompleteJob,
  canConvertEstimateToJob,
  canCreateInvoiceFromJob,
  canDismissJob,
  canEditEstimate,
  canEditInvoiceLines,
  canEditJobLines,
  canFinalizeInvoice,
  canRespondToEstimate,
  canRetrySyncInvoice,
  canSendEstimate,
  canStartJob,
} from "./status-transitions";

const JOB_STATUSES: JobStatus[] = ["SCHEDULED", "IN_PROGRESS", "DONE_NOT_INVOICED", "INVOICED", "DISMISSED"];
const ESTIMATE_STATUSES: EstimateStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED"];
const INVOICE_STATUSES: InvoiceStatus[] = ["DRAFT", "NOT_POSTED", "POSTED", "SENT", "VIEWED", "PAID"];

/** Asserts a guard is true for exactly the given statuses, out of the full enum. */
function expectAllows<T extends string>(guard: (status: T) => boolean, all: T[], allowed: T[]) {
  for (const status of all) {
    expect(guard(status), `${status} → ${allowed.includes(status)}`).toBe(allowed.includes(status));
  }
}

describe("job status transitions", () => {
  it("canStartJob: only SCHEDULED", () => {
    expectAllows(canStartJob, JOB_STATUSES, ["SCHEDULED"]);
  });

  it("canCompleteJob: SCHEDULED or IN_PROGRESS", () => {
    expectAllows(canCompleteJob, JOB_STATUSES, ["SCHEDULED", "IN_PROGRESS"]);
  });

  it("canDismissJob: only DONE_NOT_INVOICED", () => {
    expectAllows(canDismissJob, JOB_STATUSES, ["DONE_NOT_INVOICED"]);
  });

  it("canEditJobLines: anything except INVOICED", () => {
    expectAllows(canEditJobLines, JOB_STATUSES, ["SCHEDULED", "IN_PROGRESS", "DONE_NOT_INVOICED", "DISMISSED"]);
  });

  it("canCreateInvoiceFromJob: only DONE_NOT_INVOICED (the uninvoiced queue)", () => {
    expectAllows(canCreateInvoiceFromJob, JOB_STATUSES, ["DONE_NOT_INVOICED"]);
  });
});

describe("estimate status transitions", () => {
  it("canEditEstimate: only DRAFT", () => {
    expectAllows(canEditEstimate, ESTIMATE_STATUSES, ["DRAFT"]);
  });

  it("canSendEstimate: only DRAFT", () => {
    expectAllows(canSendEstimate, ESTIMATE_STATUSES, ["DRAFT"]);
  });

  it("canRespondToEstimate: only SENT", () => {
    expectAllows(canRespondToEstimate, ESTIMATE_STATUSES, ["SENT"]);
  });

  it("canConvertEstimateToJob: only ACCEPTED", () => {
    expectAllows(canConvertEstimateToJob, ESTIMATE_STATUSES, ["ACCEPTED"]);
  });
});

describe("invoice status transitions", () => {
  it("canEditInvoiceLines: only DRAFT", () => {
    expectAllows(canEditInvoiceLines, INVOICE_STATUSES, ["DRAFT"]);
  });

  it("canFinalizeInvoice: only DRAFT", () => {
    expectAllows(canFinalizeInvoice, INVOICE_STATUSES, ["DRAFT"]);
  });

  it("canRetrySyncInvoice: anything except DRAFT", () => {
    expectAllows(canRetrySyncInvoice, INVOICE_STATUSES, ["NOT_POSTED", "POSTED", "SENT", "VIEWED", "PAID"]);
  });
});
