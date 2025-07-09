import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import cors from "cors";
import { v4 as id } from "uuid";
import { Pool } from "pg";
import dotenv from "dotenv";
import transcodeVideo from "./transcoder.js";
import { Server } from "socket.io";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname,join } from "path";

const app = express();
const server = createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url))

const pooldb = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
});

// Middleware
app.use(bodyParser.json());
app.use(cors()); // FIXED: called cors()
app.use(express.urlencoded({ extended: true }));

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "videos/"),
  filename: (req, file, cb) => {
    const newFilename = `${id()}-${file.originalname}`;
    // const newFilename = `${id()}-${file.originalname
    //   .replace(/\s+/g, '_')
    //   .replace(/[^a-zA-Z0-9_.-]/g, '')}`;
    cb(null, newFilename);
  },
});
const store = multer({ storage });

// Routes
app.get("/", (req, res) => {
  res.sendFile(join(__dirname,"public/static/index.html"));
});

app.post("/upload", store.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).send("No video uploaded");
  await transcodeVideo(req, pooldb, res,io).catch((err) =>
    console.error("Overall transcoding failed:", err)
  );
});

app.get("/get-all-videos", async (req, res) => {
  let result = await pooldb.query("SELECT * from videos where is_public=true");
  return res.send(result.rows);
});

app.get("/get-specific-video", async (req, res) => {
  const { id } = req.query;
  let result = await pooldb.query("select * from videos where id=$1", [id]);
  return res.status(200).send(result.rows[0]);
});

let update_fields = async (id, field) => {
  try {
    // 1. Get current likes
    let query = await pooldb.query(`SELECT ${field} FROM videos WHERE id=$1`, [
      id,
    ]);

    if (query.rows.length === 0) {
      console.log("Video not found.");
      return null;
    }
    let count = 0;
    if (field == "likes") {
      count = query.rows[0].likes + 1;
    } else if (field == "dislikes") {
      count = query.rows[0].dislikes + 1;
    } else if (field == "views") {
      count = parseInt(query.rows[0].views) + 1;
    }

    // 2. Update likes and RETURN
    let result = await pooldb.query(
      `UPDATE videos SET ${field} = $1 WHERE id=$2`,
      [count.toString(), id]
    );
    if (field == "likes") {
      return {
        statusCode: 200,
        likes: count,
      };
    } else if (field == "dislikes") {
      return {
        statusCode: 200,
        dislikes: count,
      };
    } else if (field == "views") {
      return {
        statusCode: 200,
        views: count,
      };
    }
  } catch (err) {
    console.log(err);
  }
};

app.get("/like", async (req, res) => {
  let response = await update_fields(req.query.id, "likes");
  return res.send(response);
});
app.get("/dislike", async (req, res) => {
  let response = await update_fields(req.query.id, "dislikes");
  return res.send(response);
});

app.get("/views", async (req, res) => {
  let response = await update_fields(req.query.id, "views");
  return res.send(response);
});

// Server start
server.listen(port, () => {
  console.log(`ABR API started on port ${port}`);
});
