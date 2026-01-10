import 'dotenv/config';
import { setupWorker } from './lib/queue';
import { checkRunner } from './jobs/checkRunner';
import { startScheduler } from './jobs/scheduler';

console.log('Worker service starting...');

setupWorker(checkRunner);
startScheduler();
