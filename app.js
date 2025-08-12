import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import path from "path";
import cors from "cors";
import { v4 as id } from "uuid";
import { Pool } from "pg";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fileName from "./controllers.js";
import { s3 } from "./upload.js";
import multerS3 from "multer-s3";
import { transcodingQueue, PROGRESS_CHANNEL, pubSubSubscriber } from "./queue.js";

const app = express();
const server = createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;
dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

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
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));
app.use('/hls', express.static(path.join(__dirname, 'hls')));

// File upload setup
const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.S3_BUCKET_NAME,
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

const store = multer({ storage:s3Storage });

const thumbStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "thumbnails/"),
});

const thumbUpload = multer({ storage: thumbStorage });

pubSubSubscriber.on('message',(channel,message)=>{
  if (channel == PROGRESS_CHANNEL){
    const data = JSON.parse(message);
    io.to(data.videoId).emit('transcoding_update',data)
    console.log(`Received progress update for videoId: ${data.videoId}, status: ${data.status}`);
  }
})

pubSubSubscriber.subscribe(PROGRESS_CHANNEL,(err,count)=>{
  if (err) {
    console.error("Failed to subscribe to Redis channel:", err.message);
  } else {
    console.log(`Server subscribed to Redis channel: ${PROGRESS_CHANNEL} (count: ${count})`);
  }
})

// Routes
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public/static/index.html"));
});

// app.post("/upload", store.single("video"), async (req, res) => {
//   if (!req.file) return res.status(400).send("No video uploaded");
//     const newPath = req.file.key;
//   const videoId = id();
//   // const newPath = path.join(req.file.destination, fileName(videoId,req.file.originalname)).split(path.sep).join("/")
//   try {
//     fs.renameSync(req.file.path, newPath);
//   } catch (err) {
//     console.error("File rename failed:", err);
//     return res.status(500).send("Internal server error while renaming the file.");
//   }

//   try {
//     const cmd = "INSERT INTO video_files(id, original_file_path) VALUES ($1, $2)";
//     await pooldb.query(cmd, [videoId, newPath]);
//     console.log(newPath)
//   } catch (err) {
//     console.error("Error inserting metadata:", err);
//     return res.status(500).send("Internal server error while storing metadata.");
//   }
//   // console.log("File Has been Uploaded. Transcoding Started...")
//   // await transcodeVideo(newPath,res,io);/// I'm Here 
//   res.status(200).send({ message: "File received", id: videoId,fileUrl:newPath });
// });

app.post("/upload", store.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No video uploaded");
  }
  
  // The file is already uploaded to S3.
  // req.file.key contains the S3 key you defined in the s3Storage config.
  const videoS3Key = req.file.location;
  const videoId = id();

  try {
    const cmd = "INSERT INTO video_files(id, original_file_path) VALUES ($1, $2)";
    // Use the S3 key to store in your database.
    await pooldb.query(cmd, [videoId, videoS3Key]);
    console.log(videoS3Key);
  } catch (err) {
    console.error("Error inserting metadata:", err);
    return res.status(500).send("Internal server error while storing metadata.");
  }

  try{
    const transResponse = await transcodingQueue.add('transcode_video',{
      videoId:videoId,
      filekey:req.file.key,
    },{
      attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    });
    console.log("Queue has been created. "+ transResponse)
  }catch(err){
    console.log("Error adding in Queue\n" + err);
  }
  
  res.status(200).send({ message: "File received", id: videoId, fileUrl: videoS3Key });
});


app.post("/upload-metadata",thumbUpload.single("thumbnail"),async(req,res)=>{
  const {title, description,tags,visiblility,id} = req.body;
  const thumbnail = path.join(req.file.destination,fileName(id,req.file.originalname)).split(path.sep).join("/")
  if(!thumbnail){
    thumbnail = ''
  }else{
    try {
    fs.renameSync(req.file.path, newPath);
  } catch (err) {
    console.error("File rename failed:", err);
    return res.status(500).send("Internal server error while renaming the file.");
  }
  }
  try{
    const cmd = "insert into videos(id,title, description,tags,thumbnail,visiblility) values ($1,$2,$3,$4,$5,$6);";
    await pooldb.query(cmd,[id,title, description,tags,thumbnail,visiblility])
  }catch(err){
    console.error("Error inserting metadata:", err);
    return res.status(500).send("Internal server error while storing video information.");
  }
})

app.get("/get-all-videos", async (req, res) => {
  let result = await pooldb.query("SELECT * from videos where visibility='public'");
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


io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Client can join a specific room for a videoId to receive targeted updates
  socket.on('join_video_room', (videoId) => {
    socket.join(videoId);
    console.log(`Client ${socket.id} joined room for videoId: ${videoId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Server start
server.listen(port, () => {
  console.log(`ABR API started on port ${port}`);
});
