/**
 * BullMQ Workers Entry Point
 * Run separately: npx ts-node src/lib/queue/start-workers.ts
 */
import { renewalWorker, gracePeriodWorker } from './workers/renewal.worker';
import { addonRenewalWorker } from './workers/addon-renewal.worker';

console.log('[Workers] Starting BullMQ workers...');

renewalWorker.on('ready', () => console.log('[renewalWorker] Ready'));
gracePeriodWorker.on('ready', () => console.log('[gracePeriodWorker] Ready'));
addonRenewalWorker.on('ready', () => console.log('[addonRenewalWorker] Ready'));

renewalWorker.on('error', (err) => console.error('[renewalWorker] Error:', err));
gracePeriodWorker.on('error', (err) => console.error('[gracePeriodWorker] Error:', err));
addonRenewalWorker.on('error', (err) => console.error('[addonRenewalWorker] Error:', err));

process.on('SIGTERM', async () => {
  console.log('[Workers] SIGTERM received, shutting down...');
  await renewalWorker.close();
  await gracePeriodWorker.close();
  await addonRenewalWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Workers] SIGINT received, shutting down...');
  await renewalWorker.close();
  await gracePeriodWorker.close();
  await addonRenewalWorker.close();
  process.exit(0);
});
