import Ffmpeg from "fluent-ffmpeg";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import { PROGRESS_CHANNEL } from "./queue.js";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "./upload.js";

Ffmpeg.setFfmpegPath(ffmpegPath);

const resolutions = [
  { name: "240p", width: 426, height: 240, videoBitrate: "400k", audioBitrate: "64k" },
  { name: "360p", width: 640, height: 360, videoBitrate: "800k", audioBitrate: "96k" },
  { name: "480p", width: 854, height: 480, videoBitrate: "1200k", audioBitrate: "128k" },
  { name: "720p", width: 1280, height: 720, videoBitrate: "2500k", audioBitrate: "192k" },
  { name: "1080p", width: 1920, height: 1080, videoBitrate: "5000k", audioBitrate: "256k" },
];

export default async function transcodeVideo(inputPath, videoId, publisher) {
  const bucketName = process.env.S3_BUCKET_NAME;
  const region = process.env.AWS_REGION;

  const fileName = path.basename(inputPath);
  const folderName = fileName.substring(0, fileName.lastIndexOf("."));
  const outputDir = path.join("./abr-youtube", folderName);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Starting transcoding for: ${inputPath}`);

  // Download source video from S3 if not already local
  const localInputPath = path.join(outputDir, fileName);
  if (!fs.existsSync(localInputPath)) {
    console.log("Downloading video from S3...");
    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: bucketName, Key: inputPath })
    );
    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(localInputPath);
      Body.pipe(writeStream);
      Body.on("error", reject);
      writeStream.on("finish", resolve);
    });
  }

  const masterPlaylistContent = ["#EXTM3U", "#EXT-X-VERSION:3"];
  const transcodingPromises = [];

  for (const resDef of resolutions) {
    transcodingPromises.push(
      new Promise((resolve, reject) => {
        const outputFolderName = path.join(outputDir, resDef.name);
        if (!fs.existsSync(outputFolderName))
          fs.mkdirSync(outputFolderName, { recursive: true });

        const outputPlaylistName = `${resDef.name}.m3u8`;
        const outputVideoPath = path.join(outputFolderName, outputPlaylistName).replace(/\\/g, "/");
        const segmentPattern = path.join(outputFolderName, "segment%03d.ts").replace(/\\/g, "/");

        Ffmpeg(localInputPath)
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
              PROGRESS_CHANNEL,
              JSON.stringify({ videoId, resolution: resDef.name, status: "started" })
            );
          })
          .on("progress", (progress) => {
            publisher.publish(
              PROGRESS_CHANNEL,
              JSON.stringify({
                videoId,
                resolution: resDef.name,
                percent: `${Math.floor(progress.percent)}%`,
                status: "in_progress",
              })
            );
          })
          .on("end", () => {
            console.log(`Transcoding for ${resDef.name} finished!`);
            masterPlaylistContent.push(
              `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(resDef.videoBitrate) * 1024},RESOLUTION=${resDef.width}x${resDef.height}`,
              `${resDef.name}/${outputPlaylistName}`
            );
            publisher.publish(
              PROGRESS_CHANNEL,
              JSON.stringify({
                videoId,
                resolution: resDef.name,
                message: "Transcoding Completed",
                percent: `100%`,
                status: "Complete",
              })
            );
            resolve();
          })
          .on("error", (err) => {
            console.error(`Error transcoding ${resDef.name}:`, err.message);
            publisher.publish(
              PROGRESS_CHANNEL,
              JSON.stringify({ videoId, resolution: resDef.name, status: "failed" })
            );
            reject(err);
          })
          .run();
      })
    );
  }

  // Wait for all resolutions to finish
  await Promise.all(transcodingPromises);

  // Create master playlist
  const masterPlaylistPath = path.join(outputDir, "master.m3u8");
  fs.writeFileSync(masterPlaylistPath, masterPlaylistContent.join("\n"));
  console.log("Master playlist created:", masterPlaylistPath);

  // Remove original downloaded video
  try {
    fs.unlinkSync(localInputPath);
    console.log(`${localInputPath} was successfully deleted.`);
  } catch (err) {
    console.error("Error deleting the file:", err);
  }

  // Upload folder to S3
  const s3Prefix = `transcoded_videos/${folderName}/`;
  await uploadFolderToS3(outputDir, s3Prefix, bucketName);

  // Remove local folder
  fs.rmSync(outputDir, { recursive: true, force: true });
  console.log(`Local folder deleted: ${outputDir}`);

  // Return playlist URL
  const playlistUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${s3Prefix}master.m3u8`;
  publisher.publish(
    PROGRESS_CHANNEL,
    JSON.stringify({
      videoId,
      url: playlistUrl,
      percent: `100%`,
      status: "Complete",
      message: "Master playlist ready",
    })
  );

  return playlistUrl;
}

// Upload helper
async function uploadFolderToS3(localDir, s3Prefix, bucket) {
  const files = fs.readdirSync(localDir, { withFileTypes: true });

  for (const file of files) {
    const localPath = path.join(localDir, file.name);
    const s3Key = s3Prefix + file.name;

    if (file.isDirectory()) {
      await uploadFolderToS3(localPath, `${s3Prefix}${file.name}/`, bucket);
    } else {
      const fileStream = fs.createReadStream(localPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: fileStream,
          ContentType: getMimeType(file.name),
        })
      );
      console.log(`Uploaded: ${s3Key}`);
    }
  }
}

// MIME type helper
function getMimeType(fileName) {
  if (fileName.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (fileName.endsWith(".ts")) return "video/mp2t";
  return "application/octet-stream";
}
