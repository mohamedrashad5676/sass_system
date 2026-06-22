import { Worker, Job } from "bullmq";
import { connection, gracePeriodQueue, renewalQueue } from "../index";
import prisma from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongoose";
import Decimal from "decimal.js";

interface RenewalJobData { subscriptionId: string }

export const renewalWorker = new Worker<RenewalJobData>(
  "subscription-renewal",
  async (job: Job<RenewalJobData>) => {
    const { subscriptionId } = job.data;
    await connectMongo();

    return await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          userAccount: { include: { wallet: true, downgrade: true } },
          addonItems: {
            where: { status: "active" },
            include: { planAddon: { include: { addon: true } } },
          },
        },
      });

      if (!sub || sub.status === "cancelled") return { action: "skip" };

      if (sub.status === "cancel_pending") {
        await tx.subscription.update({ where: { id: sub.id }, data: { status: "cancelled" } });
        await tx.subscriptionAddonItem.updateMany({ where: { subscriptionId: sub.id }, data: { status: "cancelled" } });
        return { action: "cancelled" };
      }

      const pendingDowngrade = sub.userAccount.downgrade;
      let targetPlanId = sub.planId;
      let targetPlan = sub.plan;

      if (pendingDowngrade) {
        const newPlan = await tx.plan.findUnique({ where: { id: pendingDowngrade.newPlanId } });
        if (newPlan) { targetPlanId = newPlan.id; targetPlan = newPlan as typeof sub.plan; }
      }

      const walletLocked = await tx.wallet.findUnique({ where: { id: sub.userAccount.wallet!.id } });
      if (!walletLocked) throw new Error("Wallet not found");

      const planPrice = new Decimal(
        sub.billingCycle === "annual" ? targetPlan.priceAnnual.toString() : targetPlan.priceMonthly.toString()
      );

      let addonTotal = new Decimal(0);
      const addonsToCancel: string[] = [];

      const downgradeItems = pendingDowngrade
        ? await tx.downgradeAddonItem.findMany({ where: { downgradeId: pendingDowngrade.id } })
        : [];

      for (const item of sub.addonItems) {
        const shouldCancel = pendingDowngrade
          ? downgradeItems.some((d) => d.addonItemId === item.id)
          : !(item.planAddon.addon.manifest as any)?.constraints?.compatible_plans?.includes(targetPlan.name);
        if (shouldCancel) addonsToCancel.push(item.id);
        else addonTotal = addonTotal.plus(item.planAddon.price.toString());
      }

      const totalCharge = planPrice.plus(addonTotal);

      if (new Decimal(walletLocked.balance.toString()).lessThan(totalCharge)) {
        await tx.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
        const gKey = `grace-${sub.id}-${Date.now()}`;
        for (const [day, ms] of [[1, 86400000], [3, 259200000], [7, 604800000], [30, 2592000000]] as const) {
          await gracePeriodQueue.add("grace", { subscriptionId: sub.id, day }, { delay: ms, jobId: `${gKey}-d${day}` });
        }
        return { action: "past_due" };
      }

      await tx.wallet.update({ where: { id: walletLocked.id }, data: { balance: { decrement: totalCharge.toNumber() } } });

      const idKey = `renewal-${sub.id}-${Date.now()}`;
      await tx.walletTransaction.create({
        data: { walletId: walletLocked.id, type: "debit", amount: totalCharge.toNumber(), description: `Renewal: ${targetPlan.name}`, idempotencyKey: idKey },
      });

      const cycleMs = sub.billingCycle === "annual" ? 365 * 86400000 : 30 * 86400000;
      const newRenewDate = new Date(sub.renewDate.getTime() + cycleMs);

      await tx.subscription.update({ where: { id: sub.id }, data: { planId: targetPlanId, status: "active", endDate: newRenewDate, renewDate: newRenewDate } });
      if (addonsToCancel.length > 0) await tx.subscriptionAddonItem.updateMany({ where: { id: { in: addonsToCancel } }, data: { status: "cancelled" } });
      const survivingIds = sub.addonItems.filter((a) => !addonsToCancel.includes(a.id)).map((a) => a.id);
      if (survivingIds.length > 0) await tx.subscriptionAddonItem.updateMany({ where: { id: { in: survivingIds } }, data: { endTime: newRenewDate } });
      if (pendingDowngrade) await tx.downgrade.delete({ where: { id: pendingDowngrade.id } });

      await tx.invoice.create({
        data: {
          subscriptionId: sub.id, userAccountId: sub.userAccountId, totalPrice: totalCharge.toNumber(),
          status: "issued", paymentStatus: "paid", type: "subscription", idempotencyKey: idKey,
          items: { create: [{ name: targetPlan.name, description: `${sub.billingCycle} renewal`, price: planPrice.toNumber(), quantity: 1 }] },
        },
      });

      await renewalQueue.add("renew-subscription", { subscriptionId: sub.id }, { delay: cycleMs, jobId: `renewal-${sub.id}-${newRenewDate.getTime()}` });
      return { action: "renewed", newRenewDate };
    });
  },
  { connection, concurrency: 5 }
);

export const gracePeriodWorker = new Worker(
  "grace-period",
  async (job: Job) => {
    const { subscriptionId, day } = job.data as { subscriptionId: string; day: number };
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { userAccount: { include: { wallet: true } }, plan: true },
    });
    if (!sub || sub.status === "active" || sub.status === "cancelled") return;
    if (day === 7) {
      await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "suspended" } });
      await prisma.subscriptionAddonItem.updateMany({ where: { subscriptionId, status: "active" }, data: { status: "suspended" } });
    } else if (day === 30) {
      await prisma.subscription.update({ where: { id: subscriptionId }, data: { status: "cancelled" } });
      await prisma.subscriptionAddonItem.updateMany({ where: { subscriptionId }, data: { status: "cancelled" } });
    } else {
      // Day 1/3 retry
      if (!sub.userAccount.wallet) return;
      const price = sub.billingCycle === "annual" ? sub.plan.priceAnnual : sub.plan.priceMonthly;
      if (new Decimal(sub.userAccount.wallet.balance.toString()).gte(price.toString())) {
        await renewalQueue.add("renew-subscription", { subscriptionId }, { jobId: `retry-${subscriptionId}-d${day}` });
      }
    }
  },
  { connection }
);
