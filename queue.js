import { Queue } from "bullmq";
import Redis from "ioredis";

export const connection = new Redis({
    host:'localhost',
    port:6379,
    maxRetriesPerRequest:null
})

export const pubSubSubscriber = connection.duplicate()

export const transcodingQueue = new Queue('transcoding',connection)

export const PROGRESS_CHANNEL = 'video_transcoding_progress';
