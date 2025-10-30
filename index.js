import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";
import videoRoutes from "./src/routes/VideoRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import {createLogger} from "./src/services/logger.js"

export const logger = createLogger('api')
logger.info("Setup for api log.")
const app = express();
const server = createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;
dotenv.config();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

app.use("/user", userRoutes);
app.use("/videos", videoRoutes);

server.listen(port, () => {
  logger.info(`New ABR API started on port ${port}`);
});
3;
