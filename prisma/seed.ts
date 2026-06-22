import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Admin user
  const adminHash = await bcrypt.hash("admin123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@onmeeting.com" },
    update: {},
    create: { email: "admin@onmeeting.com", passwordHash: adminHash, firstName: "Admin", lastName: "User", isAdmin: true },
  });

  const adminAccount = await prisma.userAccount.create({ data: { type: "individual", name: "Admin Account" } });
  await prisma.userAccountManagement.create({ data: { userId: admin.id, userAccountId: adminAccount.id, role: "owner" } });
  await prisma.wallet.create({ data: { userAccountId: adminAccount.id } });

  // Plans
  const plans = [
    { name: "Starter", accountType: "individual" as const, seatModel: "dedicated" as const, priceMonthly: 50, priceAnnual: 500, details: { baseSeatCount: 1, maxParticipants: 50, storageGb: 10, maxMeetingDurationMin: 60, meetingQuotaDays: 7 } },
    { name: "Starter Plus", accountType: "individual" as const, seatModel: "dedicated" as const, priceMonthly: 150, priceAnnual: 1500, details: { baseSeatCount: 1, maxParticipants: 100, storageGb: 50, meetingQuotaDays: 15 } },
    { name: "Team", accountType: "organization" as const, seatModel: "dedicated" as const, priceMonthly: 300, priceAnnual: 3000, details: { baseSeatCount: 5, maxParticipants: 100, storageGb: 100 } },
    { name: "Business", accountType: "organization" as const, seatModel: "shared_pool" as const, priceMonthly: 500, priceAnnual: 5000, details: { baseRoomPoolSize: 3, maxParticipants: 100, storageGb: 500 } },
    { name: "Enterprise", accountType: "organization" as const, seatModel: "hybrid" as const, priceMonthly: 1000, priceAnnual: 10000, details: { baseSeatCount: 5, baseRoomPoolSize: 3, maxParticipants: 100, storageGb: 1000 } },
  ];

  const createdPlans: Record<string, any> = {};
  for (const p of plans) {
    const plan = await prisma.plan.upsert({
      where: { name: p.name },
      update: {},
      create: { name: p.name, accountType: p.accountType, seatModel: p.seatModel, priceMonthly: p.priceMonthly, priceAnnual: p.priceAnnual, details: { create: p.details } },
    });
    createdPlans[p.name] = plan;
  }

  // Addons
  const largeMeetingManifest = {
    type: "resource", version: "1.0.0", assigned_to: "room", name: "Large Meeting Capacity",
    billing: { model: "fixed", cycle: "plan_bound", unit: "room" },
    config_schema: {
      capacity: { type: "enum", options: [500, 1000], label: "Room Capacity", required: true },
      room_name: { type: "text", label: "Room Name / ID", required: true },
    },
    entitlement_keys: ["large_meeting_count", "large_meeting_capacity"],
    constraints: { compatible_plans: ["Starter Plus", "Team", "Business", "Enterprise"], max_per_org: 10 },
  };

  const logStorageManifest = {
    type: "resource", version: "1.0.0", assigned_to: "org", name: "Log Storage",
    billing: { model: "fixed", cycle: "plan_bound", unit: "org" },
    config_schema: { size_gb: { type: "enum", options: [100, 200, 500], label: "Additional Storage (GB)", required: true } },
    entitlement_keys: ["storage_gb"],
    constraints: { compatible_plans: ["Starter Plus", "Team", "Business", "Enterprise"], max_per_org: 5 },
  };

  const extraUsersManifest = {
    type: "resource", version: "1.0.0", assigned_to: "org", name: "Extra Users",
    billing: { model: "per_seat", cycle: "plan_bound", unit: "user" },
    config_schema: { extra_count: { type: "enum", options: [30, 60, 100], label: "Extra Users", required: true } },
    entitlement_keys: ["extra_users"],
    constraints: { compatible_plans: ["Business", "Enterprise"], max_per_org: 10 },
  };

  const largeMeeting = await prisma.addon.upsert({ where: { name: "Large Meeting Capacity" }, update: {}, create: { name: "Large Meeting Capacity", manifest: largeMeetingManifest } });
  const logStorage = await prisma.addon.upsert({ where: { name: "Log Storage" }, update: {}, create: { name: "Log Storage", manifest: logStorageManifest } });
  const extraUsers = await prisma.addon.upsert({ where: { name: "Extra Users" }, update: {}, create: { name: "Extra Users", manifest: extraUsersManifest } });

  // Link addons to plans
  const planAddonLinks = [
    { planName: "Starter Plus", addonId: largeMeeting.id, price: 35, config: { available_options: { capacity: [500, 1000] }, pricing: { capacity_500: 20, capacity_1000: 35 } } },
    { planName: "Starter Plus", addonId: logStorage.id, price: 10, config: { available_options: { size_gb: [100] }, pricing: { size_gb_100: 10 } } },
    { planName: "Team", addonId: largeMeeting.id, price: 35, config: { available_options: { capacity: [500, 1000] }, pricing: { capacity_500: 20, capacity_1000: 35 } } },
    { planName: "Team", addonId: logStorage.id, price: 10, config: { available_options: { size_gb: [100, 200] }, pricing: { size_gb_100: 10, size_gb_200: 18 } } },
    { planName: "Business", addonId: largeMeeting.id, price: 35, config: { available_options: { capacity: [500, 1000] }, pricing: { capacity_500: 20, capacity_1000: 35 } } },
    { planName: "Business", addonId: logStorage.id, price: 10, config: { available_options: { size_gb: [100, 200, 500] }, pricing: { size_gb_100: 10, size_gb_200: 18, size_gb_500: 40 } } },
    { planName: "Business", addonId: extraUsers.id, price: 30, config: { available_options: { extra_count: [30, 60, 100] }, pricing: { extra_30: 30, extra_60: 55, extra_100: 85 } } },
    { planName: "Enterprise", addonId: largeMeeting.id, price: 35, config: { available_options: { capacity: [500, 1000] }, pricing: { capacity_500: 20, capacity_1000: 35 } } },
    { planName: "Enterprise", addonId: logStorage.id, price: 10, config: { available_options: { size_gb: [100, 200, 500] }, pricing: { size_gb_100: 10, size_gb_200: 18, size_gb_500: 40 } } },
    { planName: "Enterprise", addonId: extraUsers.id, price: 30, config: { available_options: { extra_count: [30, 60, 100] }, pricing: { extra_30: 30, extra_60: 55, extra_100: 85 } } },
  ];

  for (const link of planAddonLinks) {
    const plan = createdPlans[link.planName];
    if (!plan) continue;
    await prisma.planAddon.upsert({
      where: { planId_addonId: { planId: plan.id, addonId: link.addonId } },
      update: {},
      create: { planId: plan.id, addonId: link.addonId, price: link.price, cycle: "monthly", unit: "org", config: link.config },
    });
  }

  // Sample coupon
  await prisma.coupon.upsert({
    where: { code: "WELCOME20" },
    update: {},
    create: { code: "WELCOME20", discountType: "percentage", discountValue: 20, maxGlobalUses: 100, maxPerUserUses: 1, isActive: true },
  });

  console.log("✅ Seed complete!");
  console.log("   Admin: admin@onmeeting.com / admin123456");
  console.log("   Plans: Starter, Starter Plus, Team, Business, Enterprise");
  console.log("   Addons: Large Meeting Capacity, Log Storage, Extra Users");
  console.log("   Coupon: WELCOME20 (20% off)");
}

main().catch(console.error).finally(() => prisma.$disconnect());
