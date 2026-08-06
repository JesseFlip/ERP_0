import { describe, expect, it } from "vitest";
import { buildPrivateNote, escapeQboString, idempotencyLookupClause, idempotencyMarker } from "./idempotency";

describe("escapeQboString", () => {
  it("escapes single quotes so they can't break out of a QBO query string literal", () => {
    expect(escapeQboString("O'Brien's Landscaping")).toBe("O\\'Brien\\'s Landscaping");
  });

  it("leaves strings without quotes unchanged", () => {
    expect(escapeQboString("plain-id-123")).toBe("plain-id-123");
  });
});

describe("idempotencyMarker", () => {
  it("prefixes the idempotency key with a stable, greppable marker", () => {
    expect(idempotencyMarker("abc123")).toBe("propertyops_idempotency_key:abc123");
  });
});

describe("buildPrivateNote", () => {
  it("joins memo and marker on separate lines when a memo is present", () => {
    expect(buildPrivateNote("Thanks for your business!", "abc123")).toBe(
      "Thanks for your business!\npropertyops_idempotency_key:abc123"
    );
  });

  it("is just the marker when there's no memo", () => {
    expect(buildPrivateNote(undefined, "abc123")).toBe("propertyops_idempotency_key:abc123");
  });

  it("drops an empty-string memo the same as undefined", () => {
    expect(buildPrivateNote("", "abc123")).toBe("propertyops_idempotency_key:abc123");
  });
});

describe("idempotencyLookupClause", () => {
  it("builds a LIKE clause matching the marker", () => {
    expect(idempotencyLookupClause("abc123")).toBe(
      "PrivateNote LIKE '%propertyops_idempotency_key:abc123%'"
    );
  });

  it("escapes a key containing a quote so it can't break out of the query", () => {
    // idempotencyKey is a cuid in practice, but the lookup must stay safe regardless.
    expect(idempotencyLookupClause("a'bc")).toBe(
      "PrivateNote LIKE '%propertyops_idempotency_key:a\\'bc%'"
    );
  });

  it("a retried push looks up the exact same clause for the exact same key (dedup guarantee)", () => {
    expect(idempotencyLookupClause("retry-key-1")).toBe(idempotencyLookupClause("retry-key-1"));
  });
});
