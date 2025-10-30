import multer from "multer";
import multerS3 from "multer-s3";
import { s3 } from "../config/cloudConfig.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import {createLogger} from  "../services/logger.js"

const logger = createLogger('cloudUpload')

logger.info("Setup the cloudUpload Logger")
dotenv.config({ path: "../../.env" });

const storeVideo = multerS3({
  s3: s3,
  bucket: process.env.CLOUDFLARE_BUCKET_NAME,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const fileKey = `raw_videos/${Date.now()}_${file.originalname.replace(
      /\s+/g,
      "_"
    )}`;
    cb(null, fileKey);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
});

export const storeVideoCloud = multer({ storage: storeVideo });

function getMimeType(fileName) {
  if (fileName.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (fileName.endsWith(".ts")) return "video/mp2t";
  if (fileName.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

export async function uploadFolderToS3(localDir, s3Prefix = "") {
  const bucket = process.env.CLOUDFLARE_BUCKET_NAME;
  const entries = fs.readdirSync(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    // Always use POSIX paths to avoid backslash issues on Windows
    const s3Key = path.posix.join(s3Prefix, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectory while preserving structure
      await uploadFolderToS3(localPath, s3Key);
    } else {
      const fileStream = fs.createReadStream(localPath);
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: fileStream,
            ContentType: getMimeType(entry.name),
          })
        );
      } catch (error) {
        logger.error("Error uploading :",error);
      }
    }
  }
}

export const downloadFromCloud = async (localInputPath) => {
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
};
