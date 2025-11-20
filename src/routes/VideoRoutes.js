import { Router } from "express";
import { User, Video } from "../models/model.js";
import { saveVideo } from "../storage/localStorage.js";
import { transcodingQueue } from "../scheduler/queue.js";
import { v4 as uuid } from "uuid";
import { logger } from "../../index.js";
import { verifyAccessToken } from "../middleware/authMiddleware.js";

const videoRoutes = Router();

const categories = [
  "Cars and Vehicles",
  "Comedy",
  "Education",
  "Music",
  "Film and Entertainment",
  "Gaming",
  "Entertainment",
  "How-to and style",
  "News and Politics",
  "Non-profits and activism",
  "pets and animals",
  "Sceince and technology",
  "Sport",
  "Travel and events",
];

const validateCategory = (category) => {
  if (!categories.includes(category))
    return res.status(400).json({ error: "Invalid category." });
};

videoRoutes.get("/", async (req, res) => {
  try {
    const videos = await Video.findAll({
      include: [
        { model: User, attributes: ["username", "name", "profilePictureUrl"] },
      ],
    });

    res.json(videos);
  } catch (err) {
    logger.error("Error Fetching Videos " + err);
    res.status(500).json({ error: "Error Fetching Videos" });
  }
});

videoRoutes.post(
  "/upload",
  verifyAccessToken,
  saveVideo.single("video"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send("No video uploaded");
    }
    const userId = req.body.id;
    const id = uuid();

    try {
      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "User Not found" });

      const newVideo = await Video.create({
        id,
        userId,
      });

      // Queue
      try {
        await transcodingQueue.add(
          "transcoding",
          {
            filePath: req.file.filename,
            videoId: id,
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
          }
        );
      } catch (error) {
        logger.error("Error adding job in the queue.");
        res.status(500).json({ error: "Error adding job in the queue." });
      }
      res.status(201).json({
        message: "Video Uploaded Successfully.",
        channel: `transcoding-status:${id}`,
        videoId: newVideo.id,
      });
    } catch (err) {
      logger.error("Error uploading Video: ", err);
      res.status(500).json({ error: "Error uploading Video" });
    }
  }
);

videoRoutes.put(":id/title",verifyAccessToken, async (req, res) => {
  const videoId = req.params.id;
  const newTitle = req.body.title;
  try {
    const video = await Video.findByPk(videoId);
    if (!video) return res.json({ error: "Video not found." });
    video.title = newTitle;
    await video.save();
    res.json({ message: "Title Updated Successfully", title: video.title });
  } catch (error) {
    logger.error("Failed to update title of the  video.");
    res.json({ error: "Failed to update title of the  video." });
  }
});

videoRoutes.put(":id/descriptions",verifyAccessToken, async (req, res) => {
  const videoId = req.params.id;
  const { description } = req.body;
  try {
    const video = await Video.findByPk(videoId);
    if (!video) return res.json({ error: "Video not found." });
    video.description = description;
    await video.save();
    res.json({ message: "Description Updated Successfully.", description });
  } catch (error) {
    res.json({ error: "Failed to update description of the video." });
  }
});

videoRoutes.put(":id/like",verifyAccessToken, async (req, res) => {
  const videoId = req.params.id;
  try {
    const video = await Video.findByPk(videoId);
    if (!video) return res.status(404).json({ error: "Video not found." });

    video.likes = (video.likes || 0) + 1;
    await video.save();
    res.json({ message: "Liked", likes: video.likes });
  } catch (error) {
    res.json({ error: "Failed to like video." });
  }
});

videoRoutes.put(":id/dislike",verifyAccessToken, async (req, res) => {
  const videoId = req.params.id;
  try {
    const video = await Video.findByPk(videoId);
    if (!video) return res.json({ error: "Video not found." });
    video.dislike = (video.dislike || 0) + 1;
    await video.save();
    res.json({ message: "disliked", dislikes: video.dislike });
  } catch (error) {
    res.json({ error: "Failed to dislike video." });
  }
});

videoRoutes.put(":id/view",verifyAccessToken, async (req, res) => {
  const videoId = req.params.id;
  try {
    const video = await Video.findByPk(videoId);
    if (!video) return res.json({ error: "Video not found." });
    video.views = (video.views || 0) + 1;
    await video.save();
    res.json({ message: "Updated Views", views: video.views });
  } catch (error) {
    res.json({ error: "Failed to dislike video." });
  }
});

videoRoutes.put(":id/visibility",verifyAccessToken, async (req, res) => {
  const videoId = req.params.id;
  const { visibility } = req.body;
  const validVisibilities = ["public", "private", "unlisted"];
  try {
    if (!validVisibilities.includes(visibility)) {
      return res.status(400).json({ error: "Invalid visibility value." });
    }
    const video = await Video.findByPk(videoId);
    if (!video) return res.json({ error: "Video not found." });
    video.visibility = visibility;
    await video.save();
    res.json({
      message: "Visibility Updated Successfully.",
      visibility: video.visibility,
    });
  } catch (error) {
    res.json({ error: "Failed to update visibility of the video." });
  }
});

videoRoutes.put(":id/category", verifyAccessToken,async (req, res) => {
  const videoId = req.params.id;
  const { category } = req.body;

  try {
    validateCategory(category);

    const video = await Video.findByPk(videoId);
    if (!video) return res.status(404).json({ error: "Video not found." });
    video.category = category;
    await video.save();

    res.json({
      message: "Category Updated Successfully.",
      category: video.category,
    });
  } catch (error) {
    res.json({ error: "Failed to update visibility of the video." });
  }
});

export default videoRoutes;
