import Redis from "ioredis";
import { Worker,Job } from "bullmq";
import transcodeVideo from "./transcoder.js";
import {connection} from "./queue.js"
const publisher = new Redis({
    host:"localhost",
    port:6379,
    maxLoadingRetryTime:null
})

const worker = new Worker('transcoding',async (job) => {
    const {videoId,filePath} = job.data
    try{
        await transcodeVideo(filePath,videoId,publisher);
    }catch(err){
        console.log("Error Transcoding \n" + err)
    }

},{connection,concurrency:4})