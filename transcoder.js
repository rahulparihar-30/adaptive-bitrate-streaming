import Ffmpeg from "fluent-ffmpeg";
import path from "path";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";

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

export default async function transcodeVideo(req, db, res,io) {
  const { title, description, uploader_id, tags } = req.body;
  const inputPath = req.file.path;

  // Get video metadata FIRST
  let durationSeconds;
  try {
    const metadata = await new Promise((resolve, reject) => {
      Ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) return reject(err);
        resolve(metadata);
      });
    });
    durationSeconds = metadata.format.duration;
  } catch (err) {
    console.error("Error getting metadata:", err);
    return res.status(500).send("Failed to get video metadata.");
  }

  const durationInterval = `${Math.floor(
    durationSeconds / 60
  )} minutes ${Math.round(durationSeconds % 60)} seconds`;

  const outputDir = path.join("./abr-youtube", String(uploader_id), String(Date.now()));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  console.log(`Starting transcoding for: ${inputPath}`);

  const masterPlaylistContent = ["#EXTM3U", "#EXT-X-VERSION:3"];

  for (const resDef of resolutions) {
    const outputFolderName = path.join(outputDir, resDef.name);
    if (!fs.existsSync(outputFolderName)) {
      fs.mkdirSync(outputFolderName, { recursive: true });
    }

    const outputPlaylistName = `${resDef.name}.m3u8`;
    const outputVideoPath = path.join(outputFolderName, outputPlaylistName).split(path.sep).join(path.posix.sep);
    const segmentPattern = path.join(outputFolderName, "segment%03d.ts").split(path.sep).join(path.posix.sep);

    try {
      await new Promise((resolve, reject) => {
        Ffmpeg(inputPath)
          .outputOptions([
            `-vf scale=${resDef.width}:${resDef.height}`,
            "-c:v libx264",
            "-preset medium",
            `-b:v ${resDef.videoBitrate}`,
            `-maxrate ${parseInt(resDef.videoBitrate) * 1.07}k`,
            `-bufsize ${parseInt(resDef.videoBitrate) * 1.5}k`,
            "-c:a aac",
            `-b:a ${resDef.audioBitrate}`,
            "-hls_time 10",
            "-hls_list_size 0",
            `-hls_segment_filename ${segmentPattern}`,
            "-f hls",
          ])
          .output(outputVideoPath)
          .on("start", (commandLine) => {
            io.on('connection',(socket)=>{
                console.log("Connection Established")
            })
            console.log("Spawned FFmpeg with command:", commandLine);
          })
          .on("progress", (progress) => {
            let prg = `${Math.floor(progress.percent)}%`
            let resolution = resDef.name

            io.emit('progress',{
                progress: prg,
                resolutions: resolution
            })
          })
          .on("end", () => {
            console.log(`Transcoding for ${resDef.name} finished!`);
            masterPlaylistContent.push(
              `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(resDef.videoBitrate) * 1024},RESOLUTION=${resDef.width}x${resDef.height}`,
              `${resDef.name}/${outputPlaylistName}`
            );
            resolve();
          })
          .on("error", (err, stdout, stderr) => {
            console.error(`Error transcoding ${resDef.name}:`, err.message);
            console.error("FFmpeg stdout:", stdout);
            console.error("FFmpeg stderr:", stderr);
            reject(err);
          })
          .run();
      });
      io.on("disconnect",(dis)=>{
        console.log("Done Transcoding Successfully and user got disconnected!")
      })
    } catch (error) {
      console.error(`Failed to transcode ${resDef.name}:`, error);
      return res.status(500).json({ error: `Transcoding failed for ${resDef.name}` });
    }
  }

  // Create master playlist after all transcoding
  const masterPlaylistPath = path.join(outputDir, "master.m3u8");
  fs.writeFileSync(masterPlaylistPath, masterPlaylistContent.join("\n"));
  console.log("Master playlist created:", masterPlaylistPath);

  // Insert DB record
  try {
    const cmd = `
      INSERT INTO videos
      (title, url, description, duration, uploader_id, thumbnail_url, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    const inputs = [
      title,
      outputDir,
      description,
      durationInterval,
      uploader_id,
      "//dhfldf", // thumbnail_url placeholder
      ["rahul"],
    ];

    await db.query(cmd, inputs);
    return res.status(201).json({
      masterPlaylist: masterPlaylistPath,
      duration: durationSeconds,
      msg: "Uploaded video.",
    });
  } catch (dbErr) {
    console.error("DB error:", dbErr);
    return res.status(500).send("Database insert error.");
  }
}

