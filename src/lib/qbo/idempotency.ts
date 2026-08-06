/**
 * QBO's REST API has no request-idempotency header, so we embed our own key
 * in the invoice's PrivateNote and look it up before creating one — see
 * createQboInvoice in ./client.ts. Pulled out as pure string-building so the
 * marker format and escaping can be unit tested without mocking QBO's API.
 */

const IDEMPOTENCY_MARKER_PREFIX = "propertyops_idempotency_key:";

/** Escapes a value for embedding in a QBO query-language string literal. */
export function escapeQboString(value: string) {
  return value.replace(/'/g, "\\'");
}

/** The exact marker embedded in an invoice's PrivateNote for a given idempotency key. */
export function idempotencyMarker(idempotencyKey: string) {
  return `${IDEMPOTENCY_MARKER_PREFIX}${idempotencyKey}`;
}

/** Builds the PrivateNote QBO stores: an optional memo plus the idempotency marker. */
export function buildPrivateNote(memo: string | undefined, idempotencyKey: string) {
  return [memo, idempotencyMarker(idempotencyKey)].filter(Boolean).join("\n");
}

/** The QBO query WHERE clause used to look up a previously-created invoice by idempotency key. */
export function idempotencyLookupClause(idempotencyKey: string) {
  return `PrivateNote LIKE '%${escapeQboString(idempotencyMarker(idempotencyKey))}%'`;
}
