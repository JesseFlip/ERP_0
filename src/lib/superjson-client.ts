import superjson from "superjson";

// Matching client half of superjson-server.ts's "prisma.Decimal" transformer.
// The client only ever *receives* Decimal fields (money, quantities), never
// constructs or re-serializes them, so this side stays dependency-free and
// just passes through the numeric string the server already serialized.
superjson.registerCustom<string, string>(
  {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match the type-predicate shape superjson expects
    isApplicable: (value): value is string => false,
    serialize: (value) => value,
    deserialize: (value) => value,
  },
  "prisma.Decimal"
);

export { superjson };
