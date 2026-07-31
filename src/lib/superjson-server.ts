import "server-only";
import superjson from "superjson";
import { Decimal } from "@/generated/prisma/internal/prismaNamespace";

// Prisma's Decimal fields (money, quantities) cross the tRPC boundary as plain
// numeric strings instead of superjson falling back to walking Decimal.js's
// internal {s,e,d} representation as a plain object. See superjson-client.ts
// for the matching client-side half of this transformer.
superjson.registerCustom<InstanceType<typeof Decimal>, string>(
  {
    isApplicable: (value): value is InstanceType<typeof Decimal> => Decimal.isDecimal(value),
    serialize: (value) => value.toString(),
    deserialize: (value) => new Decimal(value),
  },
  "prisma.Decimal"
);

export { superjson };
