import { Router } from "express";
import User from "../models/Users.js";
import argon2 from "argon2";
import { saveImage } from "../storage/localStorage.js";
import { uploadFile } from "../services/r2Upload.js"; 

const Register = Router();

export const isUserExists = async (email) => {
  const result = await User.findOne({ where: { email } });

  if (!result) {
    return false;
  } else {
    return true;
  }
};

Register.post("/", saveImage.single("profileImage"), async (req, res) => {
  try {
    const { name, email, password } = req.body; // now this will work

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existingUser = await isUserExists(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await argon2.hash(password, { type: argon2.argon2id });

    let uploadedUrl = null;
    if (req.file) {
      const filePath = req.file.path;
      const s3Response = await uploadFile(filePath);
      uploadedUrl = s3Response; // Cloudflare bucket URL
    }

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      profilePictureUrl: uploadedUrl, // store cloud URL
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: newUser,
    });

  } catch (error) {
    console.error("Error in register route:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


export default Register;
