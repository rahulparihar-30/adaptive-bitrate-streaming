import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";
import dotenv from "dotenv"
dotenv.config()

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials:{
    accessKeyId:process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const uploadFile = async (filePath) => {
  const fileStream = fs.createReadStream(filePath);
  console.log(filePath)
  try {
    const upload = new Upload({
      client: s3,
      params: {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: "videos/",
        Body: fileStream,
      },
    });
    const response = await upload.done();
    console.log(`Successfully uploaded ${filePath} to S3 as ${s3Key}`);
    console.log(response);
    return response;
  } catch (err) {
    console.error(`Error uploading ${filePath}:`, err);
    throw err;
  } finally {
    fileStream.destroy();
  }
};

const uploadFolder = async (fodlerPath, bucketPrefix) => {
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

export default uploadFolder;
export {s3};