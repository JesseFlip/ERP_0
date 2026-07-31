import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "owner@demo.propertyops.app";
const DEMO_PASSWORD = "demo1234";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const org = await prisma.org.upsert({
    where: { id: "demo-org" },
    update: {},
    create: { id: "demo-org", name: "Rooted Property Services" },
  });

  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      orgId: org.id,
      email: DEMO_EMAIL,
      name: "Jim (Owner)",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      role: "OWNER",
    },
  });

  const catalogItems = [
    { name: "Tree removal", kind: "SERVICE" as const, unit: "ea", defaultRate: 850 },
    { name: "Stump grinding", kind: "SERVICE" as const, unit: "ea", defaultRate: 175 },
    { name: "Lawn mowing", kind: "SERVICE" as const, unit: "visit", defaultRate: 65 },
    { name: "Hedge trimming", kind: "SERVICE" as const, unit: "hr", defaultRate: 55 },
    { name: "Debris haul-away", kind: "SERVICE" as const, unit: "load", defaultRate: 120 },
    { name: "Mulch install", kind: "MATERIAL" as const, unit: "yard", defaultRate: 95 },
  ];
  const catalog: Record<string, Awaited<ReturnType<typeof prisma.catalogItem.create>>> = {};
  for (const item of catalogItems) {
    let existing = await prisma.catalogItem.findFirst({ where: { orgId: org.id, name: item.name } });
    if (!existing) {
      existing = await prisma.catalogItem.create({ data: { ...item, orgId: org.id } });
    }
    catalog[item.name] = existing;
  }

  // Left qboCustomerId unset: these are local-only until a real QBO connection syncs
  // them, and the Customers page uses that field to show "Synced" vs "Local only".
  const customerNames = ["Alvarez Residence", "Maple Street HOA", "Thornton Family Trust", "Nguyen Family"];
  const customers: Record<string, Awaited<ReturnType<typeof prisma.customer.create>>> = {};
  for (const name of customerNames) {
    let customer = await prisma.customer.findFirst({ where: { orgId: org.id, name } });
    if (!customer) {
      customer = await prisma.customer.create({ data: { orgId: org.id, name } });
    }
    customers[name] = customer;
  }

  const crewNames = ["Crew A", "Crew B"];
  const crews: Record<string, Awaited<ReturnType<typeof prisma.crew.create>>> = {};
  for (const name of crewNames) {
    let crew = await prisma.crew.findFirst({ where: { orgId: org.id, name } });
    if (!crew) {
      crew = await prisma.crew.create({ data: { orgId: org.id, name } });
    }
    crews[name] = crew;
  }

  // Phase 1: uninvoiced queue seed jobs (unchanged from v1).
  const existingJobs = await prisma.job.count({ where: { orgId: org.id, estimateId: null, scheduledDate: null } });
  if (existingJobs === 0) {
    await prisma.job.createMany({
      data: [
        {
          orgId: org.id,
          customerId: customers["Alvarez Residence"].id,
          name: "Backyard oak removal + stump grind",
          doneDate: daysAgo(6),
          notes: "Crew added a debris haul on site — remember the extra load.",
          status: "DONE_NOT_INVOICED",
        },
        {
          orgId: org.id,
          customerId: customers["Maple Street HOA"].id,
          name: "Common area hedge trim",
          doneDate: daysAgo(3),
          notes: "Quarterly maintenance visit.",
          status: "DONE_NOT_INVOICED",
        },
        {
          orgId: org.id,
          customerId: customers["Thornton Family Trust"].id,
          name: "Spring mulch refresh",
          doneDate: daysAgo(1),
          notes: "6 yards installed, front and side beds.",
          status: "DONE_NOT_INVOICED",
        },
      ],
    });
  }

  // Phase 2/3: an estimate pipeline in every stage, plus a directly-scheduled job.
  const existingEstimates = await prisma.estimate.count({ where: { orgId: org.id } });
  if (existingEstimates === 0) {
    // A draft, never sent.
    await prisma.estimate.create({
      data: {
        orgId: org.id,
        customerId: customers["Nguyen Family"].id,
        status: "DRAFT",
        memo: "Fall cleanup + gutter clearing",
        subtotal: 320,
        total: 320,
        lines: {
          create: [
            {
              catalogItemId: catalog["Debris haul-away"].id,
              description: "Debris haul-away",
              quantity: 2,
              rate: 120,
              amount: 240,
              sortOrder: 0,
            },
            {
              description: "Gutter clearing (2 story)",
              quantity: 1,
              rate: 80,
              amount: 80,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    // Sent, awaiting the customer's reply — shows up in the dashboard stat.
    await prisma.estimate.create({
      data: {
        orgId: org.id,
        customerId: customers["Alvarez Residence"].id,
        status: "SENT",
        sentAt: daysAgo(2),
        memo: "Front yard landscaping refresh",
        subtotal: 540,
        total: 540,
        lines: {
          create: [
            {
              catalogItemId: catalog["Mulch install"].id,
              description: "Mulch install",
              quantity: 4,
              rate: 95,
              amount: 380,
              sortOrder: 0,
            },
            {
              catalogItemId: catalog["Hedge trimming"].id,
              description: "Hedge trimming",
              quantity: 2,
              rate: 55,
              amount: 110,
              sortOrder: 1,
            },
            { description: "Delivery fee", quantity: 1, rate: 50, amount: 50, sortOrder: 2 },
          ],
        },
      },
    });

    // Accepted and converted to a scheduled job — the full Phase 2 -> Phase 3 loop.
    const acceptedEstimate = await prisma.estimate.create({
      data: {
        orgId: org.id,
        customerId: customers["Maple Street HOA"].id,
        status: "ACCEPTED",
        sentAt: daysAgo(5),
        respondedAt: daysAgo(4),
        memo: "Quarterly grounds maintenance",
        subtotal: 250,
        total: 250,
        lines: {
          create: [
            {
              catalogItemId: catalog["Lawn mowing"].id,
              description: "Lawn mowing",
              quantity: 2,
              rate: 65,
              amount: 130,
              sortOrder: 0,
            },
            {
              catalogItemId: catalog["Hedge trimming"].id,
              description: "Hedge trimming",
              quantity: 2,
              rate: 55,
              amount: 110,
              sortOrder: 1,
            },
            { description: "Trip fee", quantity: 1, rate: 10, amount: 10, sortOrder: 2 },
          ],
        },
      },
      include: { lines: true },
    });

    await prisma.job.create({
      data: {
        orgId: org.id,
        customerId: acceptedEstimate.customerId,
        name: acceptedEstimate.memo!,
        status: "SCHEDULED",
        estimateId: acceptedEstimate.id,
        scheduledDate: daysFromNow(2),
        scheduledWindow: "8am–10am",
        crewId: crews["Crew A"].id,
        lines: {
          create: acceptedEstimate.lines.map((line) => ({
            catalogItemId: line.catalogItemId,
            description: line.description,
            quantity: line.quantity,
            rate: line.rate,
            amount: line.amount,
            lineType: "PLANNED" as const,
            sortOrder: line.sortOrder,
          })),
        },
      },
    });

    // A job scheduled directly, no estimate — shows the schedule board's other entry point.
    await prisma.job.create({
      data: {
        orgId: org.id,
        customerId: customers["Thornton Family Trust"].id,
        name: "Storm damage limb removal",
        status: "SCHEDULED",
        scheduledDate: daysFromNow(1),
        scheduledWindow: "1pm–3pm",
        crewId: crews["Crew B"].id,
        notes: "Customer says the limb is resting on the fence line — bring the chainsaw with the longer bar.",
      },
    });
  }

  console.log("Seeded demo org:", org.name);
  console.log("Login with:", DEMO_EMAIL, "/", DEMO_PASSWORD);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
