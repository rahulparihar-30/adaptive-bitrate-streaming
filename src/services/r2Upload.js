import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import {s3} from "../config/cloudConfig.js"
import dotenv from "dotenv"
dotenv.config()

export const uploadFile = async (filePath) => {
  const fileStream = fs.createReadStream(filePath);
  const s3Key = path.posix.join('user-pictures', path.basename(filePath)); // ensures forward slashes
  console.log(filePath)
  try {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
      },
      forcePathStyle: true,
    });
    await upload.done();
    console.log(s3Key)
    return s3Key;
  } catch (err) {
    console.error(`Error uploading ${filePath}:`, err);
    throw err;
  } finally {
    fileStream.destroy();
  }
};

export const uploadFolder = async (fodlerPath, bucketPrefix) => {
  const absolutePath = path.resolve(fodlerPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Folder does not exist: ${absolutePath}`);
    return;
  }

  const items = fs.readdirSync(absolutePath);
  for (const item of items) {
    const itemPath = path.join(absolutePath, item);
    const stats = fs.statSync(itemPath);
    if (stats.isDirectory()) {
      await uploadFile(itemPath, path.join(bucketPrefix, item));
    } else {
      const s3Key = path.join(bucketPrefix, item);
      await uploadSingleFile(itemPath, process.env.S3_BUCKET_NAME, s3Key);
    }
  }
};
