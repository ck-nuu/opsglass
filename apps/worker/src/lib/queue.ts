import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
});

export const checkQueue = new Queue('check-queue', { connection: connection as any });

export const setupWorker = (processor: any) => {
    const worker = new Worker('check-queue', processor, { connection: connection as any });
    worker.on('completed', (job) => {
        console.log(`Job ${job.id} completed`);
    });
    worker.on('failed', (job, err) => {
        console.log(`Job ${job?.id} failed: ${err.message}`);
    });
    return worker;
};
