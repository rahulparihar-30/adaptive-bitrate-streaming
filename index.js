import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { createServer } from "http";
import videoRoutes from "./src/routes/VideoRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import {createLogger} from "./src/services/logger.js"
import authRoute from "./src/routes/authRoutes.js";
import { verifyAccessToken } from "./src/middleware/authMiddleware.js";

export const logger = createLogger('api')
logger.info("Setup for api log.")
const app = express();
const server = createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3000;
dotenv.config();

// Middleware
app.use(bodyParser.json());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials:true
}));
app.use(express.urlencoded({ extended: true }));

app.use("/user", verifyAccessToken,userRoutes);
app.use("/videos", videoRoutes);
app.use("/auth",authRoute);

server.listen(port, () => {
  logger.info(`New ABR API started on port ${port}`);
});
3;
