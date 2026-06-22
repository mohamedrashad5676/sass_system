import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ─── QUEUES ──────────────────────────────────────────────────────────────────
export const renewalQueue = new Queue("subscription-renewal", { connection });
export const gracePeriodQueue = new Queue("grace-period", { connection });
export const addonRenewalQueue = new Queue("addon-renewal", { connection });

export { connection };
