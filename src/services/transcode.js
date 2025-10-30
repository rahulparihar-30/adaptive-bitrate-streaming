import Ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import fs from "fs";
import { progressChannel } from "../scheduler/queue.js";
import { uploadFolderToS3 } from "../storage/cloudStorage.js";
import Video from "../models/Video.js";
import { createLogger } from "./logger.js";

const logger = createLogger('transcoding')

Ffmpeg.setFfmpegPath(ffmpegPath);
const resolutions = [
  {
    name: "240p",
    width: 426,
    height: 240,
    videoBitrate: "400k",
    audioBitrate: "64k",
  },
  {
    name: "360p",
    width: 640,
    height: 360,
    videoBitrate: "800k",
    audioBitrate: "96k",
  },
  {
    name: "480p",
    width: 854,
    height: 480,
    videoBitrate: "1200k",
    audioBitrate: "128k",
  },
  {
    name: "720p",
    width: 1280,
    height: 720,
    videoBitrate: "2500k",
    audioBitrate: "192k",
  },
  {
    name: "1080p",
    width: 1920,
    height: 1080,
    videoBitrate: "5000k",
    audioBitrate: "256k",
  },
];

export const getDuration = async (filePath) => {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
};

function parseTimemark(timemark) {
  const [h, m, s] = timemark.split(":").map(parseFloat);
  return h * 3600 + m * 60 + s;
}

const transcode = async (inputPuth, publisher, videoId) => {
  const fileName = path.basename(inputPuth.split("_")[1]);
  const folderName = videoId + fileName.substring(0, fileName.lastIndexOf("."));
  const outputDir = path.join("../../abr-youtube", folderName);
  const localPath = path.join("../../videos", path.basename(inputPuth));
  const channel = progressChannel(videoId);
  let duration;
  try {
    duration = await getDuration(localPath);
  } catch (error) {
    logger.error("Error getting Duration.");
    throw error;
  }
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  publisher.publish(
    channel,
    JSON.stringify({ message: "Starting transcoding for " + videoId })
  );

  const masterPlaylistContent = ["#EXTM3U", "#EXT-X-VERSION:3"];
  const transcodingPromises = [];

  for (const resDef of resolutions) {
    transcodingPromises.push(
      new Promise((resolve, reject) => {
        const outputFolderName = path.join(outputDir, resDef.name);
        if (!fs.existsSync(outputFolderName))
          fs.mkdirSync(outputFolderName, { recursive: true });

        const outputPlaylistName = `${resDef.name}.m3u8`;
        const outputVideoPath = path
          .join(outputFolderName, outputPlaylistName)
          .replace(/\\/g, "/");
        const segmentPattern = path
          .join(outputFolderName, "segment%03d.ts")
          .replace(/\\/g, "/");
        Ffmpeg(localPath)
          .outputOptions([
            `-vf scale=${resDef.width}:${resDef.height}`,
            "-c:v libx264",
            "-preset medium",
            `-b:v ${resDef.videoBitrate}`,
            `-maxrate ${parseInt(resDef.videoBitrate)}k`,
            `-bufsize ${parseInt(resDef.videoBitrate) * 1.5}k`,
            "-c:a aac",
            `-b:a ${resDef.audioBitrate}`,
            "-hls_time 10",
            "-hls_list_size 0",
            `-hls_segment_filename ${segmentPattern}`,
            "-f hls",
          ])
          .output(outputVideoPath)
          .on("start", () => {
            publisher.publish(
              channel,
              JSON.stringify({
                message: "Transcoding for " + videoId + " " + resDef,
              })
            );
          })
          .on("progress", (progress) => {
            if (progress.timemark) {
              const timeInSeconds = parseTimemark(progress.timemark);
              const percent = (timeInSeconds / duration) * 100;
              const rounded = Math.min(100, Math.floor(percent));
              publisher.publish(channel, JSON.stringify({ percent: rounded }));
            }

          })
          .on("end", () => {
            masterPlaylistContent.push(
              `#EXT-X-STREAM-INF:BANDWIDTH=${
                parseInt(resDef.videoBitrate) * 1024
              },RESOLUTION=${resDef.width}x${resDef.height}`,
              `${resDef.name}/${outputPlaylistName}`
            );
            publisher.publish(
              channel,
              JSON.stringify({
                message: "Transcoding done for " + resDef.name,
                resolution: resDef.name,
                percent: 100,
              })
            );
            resolve();
          })
          .on("error", (error) => {
            publisher.publish(
              channel,
              JSON.stringify({
                message: "Error transcoding " + videoId,
                err: error,
              })
            );
            logger.error("Error Transcoding ", error.message);
          })
          .run();
      })
    );
  }
  await Promise.all(transcodingPromises);

  const masterPlaylistPath = path.join(outputDir, "master.m3u8");
  fs.writeFileSync(masterPlaylistPath, masterPlaylistContent.join("\n"));


  try {
    await uploadFolderToS3(outputDir, `${folderName}/`);
    fs.unlinkSync(localPath);
    console.log
  } catch (err) {
    logger.error("Upload failed, keeping local file for retry:", err);
  }

  setTimeout(() => {
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
  } catch (err) {
    logger.error("Error deleting local folder:", err);
  }
}, 1000);

  const playlistUrl = `${process.env.ACCESS_URL}/${folderName}/master.m3u8`;
  publisher.publish(
    channel,
    JSON.stringify({
      message: "Final Url for streaming.",
      fileUrl: playlistUrl,
    })
  );

  const video = await Video.findByPk(videoId);
  video.videoUrl = playlistUrl;
  video.duration = duration;
  await video.save();
};

export default transcode;
