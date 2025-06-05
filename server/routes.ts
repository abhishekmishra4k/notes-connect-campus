import type { Express } from "express";
import { createServer, type Server } from "http";
import { insertUserSchema, loginSchema, insertNoteSchema } from "@shared/schema";
import { User } from "./models/User";
import { Note } from "./models/Note";
import { generateToken, verifyToken, AuthRequest } from "./middleware/auth";
import { upload } from "./middleware/upload";
import connectDB from "./config/database";
import path from "path";
import fs from "fs";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Connect to MongoDB
  await connectDB();

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: userData.email }, { username: userData.username }]
      });
      
      if (existingUser) {
        return res.status(400).json({ 
          message: "User already exists with this email or username" 
        });
      }

      const user = new User(userData);
      await user.save();
      
      const token = generateToken(user._id.toString());
      
      res.json({
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await User.findOne({ email });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken(user._id.toString());
      
      res.json({
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", verifyToken, async (req: AuthRequest, res) => {
    res.json({
      user: {
        _id: req.user!._id,
        username: req.user!.username,
        email: req.user!.email,
        role: req.user!.role,
        createdAt: req.user!.createdAt,
        updatedAt: req.user!.updatedAt
      }
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Notes routes
  app.post("/api/notes/upload", verifyToken, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { title, subject, description } = req.body;
      
      const noteData = {
        title,
        subject,
        description,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user!._id
      };

      insertNoteSchema.parse(noteData);

      const note = new Note(noteData);
      await note.save();
      
      await note.populate('uploadedBy', 'username email');

      res.json({ message: "File uploaded successfully", note });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.get("/api/notes", async (req, res) => {
    try {
      const { subject, search, page = 1, limit = 10 } = req.query;
      
      const query: any = {};
      
      if (subject && subject !== 'all') {
        query.subject = subject;
      }
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      const notes = await Note.find(query)
        .populate('uploadedBy', 'username email')
        .sort({ createdAt: -1 })
        .limit(Number(limit) * 1)
        .skip((Number(page) - 1) * Number(limit));

      const total = await Note.countDocuments(query);

      res.json({
        notes,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      console.error("Get notes error:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.get("/api/notes/:id/download", verifyToken, async (req: AuthRequest, res) => {
    try {
      const note = await Note.findById(req.params.id);
      
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      const filePath = path.join(__dirname, 'uploads', note.fileName);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Increment download count
      note.downloads += 1;
      await note.save();

      res.download(filePath, note.originalName);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Download failed" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', verifyToken, (req: AuthRequest, res, next) => {
    // Only authenticated users can access files
    next();
  });

  const httpServer = createServer(app);

  return httpServer;
}
