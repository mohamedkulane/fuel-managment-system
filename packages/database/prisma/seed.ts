import { PrismaClient, Prisma } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error("BOOTSTRAP_OWNER_EMAIL and a 12+ character BOOTSTRAP_OWNER_PASSWORD are required");
  }

  const owner = await prisma.user.upsert({
    where: { email },
    update: { displayName: "Owner", role: "OWNER", isActive: true },
    create: { email, displayName: "Owner", role: "OWNER", passwordHash: await argon2.hash(password) }
  });
  const diesel = await prisma.fuelType.upsert({ where: { code: "DIESEL" }, update: {}, create: { code: "DIESEL", displayName: "Diesel / Naafto" } });
  const petrol = await prisma.fuelType.upsert({ where: { code: "PETROL" }, update: {}, create: { code: "PETROL", displayName: "Petrol / Basiin" } });
  const fuusto = await prisma.salesUnit.upsert({ where: { code: "FUUSTO" }, update: {}, create: { code: "FUUSTO", name: "Fuusto (owner-configured liters)" } });
  for (const fuel of [diesel, petrol]) {
    await prisma.stockBalance.upsert({ where: { fuelId_location: { fuelId: fuel.id, location: "WAREHOUSE" } }, update: {}, create: { fuelId: fuel.id, location: "WAREHOUSE", balanceLiters: new Prisma.Decimal(0) } });
    await prisma.stockBalance.upsert({ where: { fuelId_location: { fuelId: fuel.id, location: "IN_TRANSIT" } }, update: {}, create: { fuelId: fuel.id, location: "IN_TRANSIT", balanceLiters: new Prisma.Decimal(0) } });
  }
  console.log(`Seeded owner ${owner.email}; fuels and stock projections are ready. No fuusto capacity or price was invented.`);
}

main().finally(() => prisma.$disconnect());
