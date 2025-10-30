import Redis from "ioredis";
import { Worker, Job } from "bullmq";
import { connection } from "./queue.js";
import transcode from "../services/transcode.js";
import { createLogger } from "../services/logger.js";

const logger = createLogger('worker')
logger.info("Log for worker.")

const publisher = new Redis({
  host: "localhost",
  port: 6379,
  maxLoadingRetryTime: null,
});

const worker = new Worker(
  "transcoding",
  async (job) => {
    const { filePath,videoId } = job.data;
    try {
      await transcode(filePath,publisher,videoId);
    } catch (err) {
      logger.error("Error Transcoding \n" + err);
      throw err;
    }
  },
  { connection, concurrency: 5,maxStalledCount:1,lockDuration: 1000 * 60 * 15}
);

worker.on('ready', () => {
  logger.info("Worker is ready to process jobs!");
});

worker.on('active', (job) => {
  logger.info(`Worker Activated id ${job.id} with videoId ${job.data.videoId}`);
});

worker.on('progress', (job, progress) => {
  logger.info(`Completed ${progress}% Worker id ${job.id} with videoId ${job.data.videoId}`);
});

worker.on('completed', (job) => {
  logger.info(`Completed for Worker id ${job.id} with videoId ${job.data.videoId}`);
});

worker.on('failed', (job, err) => {
  logger.error(`Failed for Worker id ${job.id} with videoId ${job.data.videoId}`);
  logger.error(err);
});
