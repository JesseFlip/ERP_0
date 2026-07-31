import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { qboApiBase, QBO_MINOR_VERSION } from "./config";
import { refreshTokens } from "./oauth";

export class QboNotConnectedError extends Error {
  constructor() {
    super("This organization has not connected QuickBooks Online yet.");
    this.name = "QboNotConnectedError";
  }
}

const REFRESH_SKEW_MS = 2 * 60 * 1000; // refresh 2 min before expiry

/** Loads (and refreshes if needed) the org's QBO access token. Persists rotated tokens. */
async function getValidAccessToken(orgId: string): Promise<{ accessToken: string; realmId: string }> {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });

  if (!org.qboRealmId || !org.qboAccessToken || !org.qboRefreshToken) {
    throw new QboNotConnectedError();
  }

  const expiresAt = org.qboAccessTokenExpiresAt?.getTime() ?? 0;
  if (Date.now() < expiresAt - REFRESH_SKEW_MS) {
    return { accessToken: decryptSecret(org.qboAccessToken), realmId: org.qboRealmId };
  }

  const refreshToken = decryptSecret(org.qboRefreshToken);
  const tokens = await refreshTokens(refreshToken);

  const now = Date.now();
  await prisma.org.update({
    where: { id: orgId },
    data: {
      qboAccessToken: encryptSecret(tokens.access_token),
      qboRefreshToken: encryptSecret(tokens.refresh_token),
      qboAccessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
      qboRefreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
    },
  });

  return { accessToken: tokens.access_token, realmId: org.qboRealmId };
}

async function qboRequest<T>(
  orgId: string,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const { accessToken, realmId } = await getValidAccessToken(orgId);
  const url = new URL(`${qboApiBase()}/v3/company/${realmId}${path}`);
  url.searchParams.set("minorversion", QBO_MINOR_VERSION);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`QBO API ${init.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

function escapeQboString(value: string) {
  return value.replace(/'/g, "\\'");
}

async function query<T>(orgId: string, entity: string, whereClause: string): Promise<T[]> {
  const q = `SELECT * FROM ${entity} WHERE ${whereClause} MAXRESULTS 100`;
  const result = await qboRequest<{ QueryResponse?: Record<string, T[]> }>(orgId, "/query", {
    query: { query: q },
  });
  return result.QueryResponse?.[entity] ?? [];
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export type QboCustomer = {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  BillAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string };
};

export async function listQboCustomers(orgId: string): Promise<QboCustomer[]> {
  return query<QboCustomer>(orgId, "Customer", "Active = true");
}

export async function createQboCustomer(
  orgId: string,
  input: { name: string; email?: string; phone?: string }
): Promise<QboCustomer> {
  const result = await qboRequest<{ Customer: QboCustomer }>(orgId, "/customer", {
    method: "POST",
    body: {
      DisplayName: input.name,
      ...(input.email ? { PrimaryEmailAddr: { Address: input.email } } : {}),
      ...(input.phone ? { PrimaryPhone: { FreeFormNumber: input.phone } } : {}),
    },
  });
  return result.Customer;
}

// ---------------------------------------------------------------------------
// Items (catalog)
// ---------------------------------------------------------------------------

export type QboItem = {
  Id: string;
  Name: string;
  Description?: string;
  UnitPrice?: number;
  Type: string;
};

export async function listQboItems(orgId: string): Promise<QboItem[]> {
  return query<QboItem>(orgId, "Item", "Active = true");
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export type QboInvoiceLine = {
  Amount: number;
  DetailType: "SalesItemLineDetail";
  Description?: string;
  SalesItemLineDetail: {
    ItemRef?: { value: string };
    Qty: number;
    UnitPrice: number;
  };
};

export type QboInvoice = {
  Id: string;
  SyncToken: string;
  DocNumber?: string;
  TotalAmt: number;
  Balance: number;
  EmailStatus?: string;
  PrivateNote?: string;
};

const IDEMPOTENCY_MARKER_PREFIX = "propertyops_idempotency_key:";

/** Finds a previously-created invoice by our idempotency key, embedded in PrivateNote. */
export async function findQboInvoiceByIdempotencyKey(
  orgId: string,
  idempotencyKey: string
): Promise<QboInvoice | null> {
  const marker = `${IDEMPOTENCY_MARKER_PREFIX}${idempotencyKey}`;
  const matches = await query<QboInvoice>(
    orgId,
    "Invoice",
    `PrivateNote LIKE '%${escapeQboString(marker)}%'`
  );
  return matches[0] ?? null;
}

export async function createQboInvoice(
  orgId: string,
  input: {
    customerId: string;
    idempotencyKey: string;
    memo?: string;
    lines: Array<{ description: string; quantity: number; rate: number; amount: number; qboItemId?: string }>;
  }
): Promise<QboInvoice> {
  // Idempotency: QBO's REST API has no request-idempotency header, so we embed our
  // key in PrivateNote and check for it before creating (see findQboInvoiceByIdempotencyKey).
  // A retry after a network partition therefore adopts the prior invoice instead of
  // double-billing the customer.
  const existing = await findQboInvoiceByIdempotencyKey(orgId, input.idempotencyKey);
  if (existing) return existing;

  const privateNote = [input.memo, `${IDEMPOTENCY_MARKER_PREFIX}${input.idempotencyKey}`]
    .filter(Boolean)
    .join("\n");

  const result = await qboRequest<{ Invoice: QboInvoice }>(orgId, "/invoice", {
    method: "POST",
    body: {
      CustomerRef: { value: input.customerId },
      PrivateNote: privateNote,
      Line: input.lines.map((line) => ({
        Amount: line.amount,
        DetailType: "SalesItemLineDetail",
        Description: line.description,
        SalesItemLineDetail: {
          ...(line.qboItemId ? { ItemRef: { value: line.qboItemId } } : {}),
          Qty: line.quantity,
          UnitPrice: line.rate,
        },
      })),
    },
  });
  return result.Invoice;
}

export async function getQboInvoice(orgId: string, qboInvoiceId: string): Promise<QboInvoice> {
  const result = await qboRequest<{ Invoice: QboInvoice }>(orgId, `/invoice/${qboInvoiceId}`);
  return result.Invoice;
}

export async function getCompanyInfo(orgId: string) {
  const { realmId } = await getValidAccessToken(orgId);
  return qboRequest<{ CompanyInfo: { CompanyName: string } }>(orgId, `/companyinfo/${realmId}`);
}
