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
  for (const item of catalogItems) {
    const existing = await prisma.catalogItem.findFirst({ where: { orgId: org.id, name: item.name } });
    if (!existing) {
      await prisma.catalogItem.create({ data: { ...item, orgId: org.id } });
    }
  }

  // Left qboCustomerId unset: these are local-only until a real QBO connection syncs
  // them, and the Customers page uses that field to show "Synced" vs "Local only".
  const customerNames = ["Alvarez Residence", "Maple Street HOA", "Thornton Family Trust"];
  const customers = [];
  for (const name of customerNames) {
    let customer = await prisma.customer.findFirst({ where: { orgId: org.id, name } });
    if (!customer) {
      customer = await prisma.customer.create({ data: { orgId: org.id, name } });
    }
    customers.push(customer);
  }

  const existingJobs = await prisma.job.count({ where: { orgId: org.id } });
  if (existingJobs === 0) {
    await prisma.job.createMany({
      data: [
        {
          orgId: org.id,
          customerId: customers[0].id,
          name: "Backyard oak removal + stump grind",
          doneDate: daysAgo(6),
          notes: "Crew added a debris haul on site — remember the extra load.",
          status: "DONE_NOT_INVOICED",
        },
        {
          orgId: org.id,
          customerId: customers[1].id,
          name: "Common area hedge trim",
          doneDate: daysAgo(3),
          notes: "Quarterly maintenance visit.",
          status: "DONE_NOT_INVOICED",
        },
        {
          orgId: org.id,
          customerId: customers[2].id,
          name: "Spring mulch refresh",
          doneDate: daysAgo(1),
          notes: "6 yards installed, front and side beds.",
          status: "DONE_NOT_INVOICED",
        },
      ],
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
