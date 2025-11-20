import { sequelize } from "../config/db.js";
import { DataTypes } from "sequelize";
import User from "./Users.js"

const Video = sequelize.define(
  "Video",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue:DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: "id",
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    videoURL: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    thumbnailURL: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    visibility: {
      type: DataTypes.ENUM("public", "private", "unlisted"),
      defaultValue: "private",
    },
    duration: { type: DataTypes.INTEGER,allowNull:true },
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    likes: { type: DataTypes.INTEGER, defaultValue: 0 },
    dislike: { type: DataTypes.INTEGER, defaultValue: 0},
    category: {
      type: DataTypes.ENUM(
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
        "Travel and events"
      ),
      defaultValue:'Entertainment'
    },
  },
  { timestamps: true }
);

export default Video;
