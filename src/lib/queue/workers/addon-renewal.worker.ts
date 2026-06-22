/**
 * Addon Renewal Worker — Annual Plan Exception
 *
 * Fires monthly for addons on annual subscriptions.
 * An annual-plan addon renews monthly (not yearly).
 * The job still checks the parent subscription status first.
 */
import { Worker, Job } from "bullmq";
import { connection, addonRenewalQueue } from "../index";
import prisma from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongoose";
import { Entitlement } from "@/lib/db/models/entitlement.model";
import Decimal from "decimal.js";

interface AddonRenewalJobData {
  subscriptionAddonItemId: string;
}

export const addonRenewalWorker = new Worker<AddonRenewalJobData>(
  "addon-renewal",
  async (job: Job<AddonRenewalJobData>) => {
    const { subscriptionAddonItemId } = job.data;
    await connectMongo();

    const addonItem = await prisma.subscriptionAddonItem.findUnique({
      where: { id: subscriptionAddonItemId },
      include: {
        subscription: {
          include: {
            userAccount: { include: { wallet: true } },
            plan: true,
          },
        },
        planAddon: { include: { addon: true } },
      },
    });

    if (!addonItem) return { action: "skip", reason: "not_found" };
    if (addonItem.status === "cancelled") return { action: "skip", reason: "cancelled" };

    const sub = addonItem.subscription;

    // Guard: parent subscription must be active
    if (sub.status === "past_due" || sub.status === "suspended") {
      await prisma.subscriptionAddonItem.update({
        where: { id: addonItem.id },
        data: { status: "suspended" },
      });
      // Reschedule to check again in 1 day (will recover when subscription recovers)
      await addonRenewalQueue.add(
        "renew-addon",
        { subscriptionAddonItemId },
        { delay: 24 * 60 * 60 * 1000, jobId: `addon-retry-${addonItem.id}-${Date.now()}` }
      );
      return { action: "suspended", reason: "parent_subscription_not_active" };
    }

    if (sub.status === "cancelled") {
      await prisma.subscriptionAddonItem.update({
        where: { id: addonItem.id },
        data: { status: "cancelled" },
      });
      // Reset entitlements in MongoDB
      await resetEntitlements(sub.userAccountId, addonItem.planAddon.addon.manifest as any);
      return { action: "cancelled", reason: "parent_subscription_cancelled" };
    }

    // If it was suspended from a prior retry and subscription is now active, resume
    if (addonItem.status === "suspended" && sub.status === "active") {
      await prisma.subscriptionAddonItem.update({
        where: { id: addonItem.id },
        data: { status: "active" },
      });
    }

    // Charge monthly addon price
    const addonPrice = new Decimal(addonItem.planAddon.price.toString());
    const wallet = sub.userAccount.wallet!;

    if (new Decimal(wallet.balance.toString()).lessThan(addonPrice)) {
      // Insufficient funds — suspend addon (follows subscription grace period flow)
      await prisma.subscriptionAddonItem.update({
        where: { id: addonItem.id },
        data: { status: "suspended" },
      });
      // Retry in 3 days
      await addonRenewalQueue.add(
        "renew-addon",
        { subscriptionAddonItemId },
        { delay: 3 * 24 * 60 * 60 * 1000, jobId: `addon-retry-${addonItem.id}-${Date.now()}` }
      );
      return { action: "suspended", reason: "insufficient_balance" };
    }

    const idKey = `addon-renewal-${addonItem.id}-${Date.now()}`;
    const newEndTime = new Date(addonItem.endTime.getTime() + 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: addonPrice.toNumber() } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "debit",
          amount: addonPrice.toNumber(),
          description: `Monthly Addon Renewal: ${addonItem.planAddon.addon.name}`,
          idempotencyKey: idKey,
        },
      });

      await tx.subscriptionAddonItem.update({
        where: { id: addonItem.id },
        data: { status: "active", endTime: newEndTime },
      });

      await tx.invoice.create({
        data: {
          subscriptionId: sub.id,
          userAccountId: sub.userAccountId,
          totalPrice: addonPrice.toNumber(),
          status: "issued",
          paymentStatus: "paid",
          type: "addon",
          idempotencyKey: idKey,
          items: {
            create: [
              {
                name: addonItem.planAddon.addon.name,
                description: "Monthly addon renewal (annual plan)",
                price: addonPrice.toNumber(),
                quantity: 1,
              },
            ],
          },
        },
      });
    });

    // Schedule next monthly renewal
    await addonRenewalQueue.add(
      "renew-addon",
      { subscriptionAddonItemId },
      {
        delay: 30 * 24 * 60 * 60 * 1000,
        jobId: `addon-renewal-${addonItem.id}-${newEndTime.getTime()}`,
      }
    );

    return { action: "renewed", newEndTime };
  },
  { connection, concurrency: 5 }
);

async function resetEntitlements(userAccountId: string, manifest: any) {
  if (!manifest?.entitlement_keys) return;
  const unsetFields: Record<string, string> = {};
  for (const key of manifest.entitlement_keys) {
    unsetFields[`limits.${key}`] = "";
    unsetFields[`usage.${key}`] = "";
  }
  await Entitlement.updateOne(
    { user_account_id: userAccountId },
    { $unset: unsetFields, $set: { updated_at: new Date() } }
  );
}
