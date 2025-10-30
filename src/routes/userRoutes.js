import { Router } from "express";
import User from "../models/Users.js";

const userRoutes = Router();

userRoutes.get("/", async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({ message: "Users fetched", users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

userRoutes.post("/", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(409)
        .json({ message: "User with this email already exists." });
    }
    const newUser = await User.create({name, email, password});
    res
      .status(201)
      .json({ message: "User registered successfully.", user: newUser });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


export default userRoutes