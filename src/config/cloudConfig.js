import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv"
dotenv.config({path:'../../.env'})

export const s3 = new S3Client({
  region: "auto",
  endpoint:process.env.CLOUDFLARE_R2_API,
  credentials:{
    accessKeyId:process.env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey:process.env.CLOUDFLARE_SECRET_ACCESS_KEY,
  }
});
