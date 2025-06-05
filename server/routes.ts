import type { Express } from "express";
import { createServer, type Server } from "http";
import { insertUserSchema, loginSchema, insertNoteSchema } from "@shared/schema";
import { upload } from "./middleware/upload";
import path from "path";
import fs from "fs";
import { z } from "zod";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// In-memory storage for demo
interface User {
  _id: string;
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

interface Note {
  _id: string;
  title: string;
  subject: string;
  description?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  downloads: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

const users: Map<string, User> = new Map();
const notes: Map<string, Note> = new Map();
const sessions: Map<string, string> = new Map(); // token -> userId

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

const verifyToken = (req: any, res: any, next: any) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = users.get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {

  // Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = Array.from(users.values()).find(
        user => user.email === userData.email || user.username === userData.username
      );
      
      if (existingUser) {
        return res.status(400).json({ 
          message: "User already exists with this email or username" 
        });
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const userId = Date.now().toString();
      const user: User = {
        _id: userId,
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        role: userData.role || 'user',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      users.set(userId, user);
      
      const token = generateToken(userId);
      sessions.set(token, userId);
      
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
      
      const user = Array.from(users.values()).find(u => u.email === email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = generateToken(user._id);
      sessions.set(token, user._id);
      
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

  app.get("/api/auth/me", verifyToken, async (req: any, res) => {
    res.json({
      user: {
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      }
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Notes routes
  app.post("/api/notes/upload", verifyToken, upload.single('file'), async (req: any, res) => {
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
      };

      insertNoteSchema.parse(noteData);

      const noteId = Date.now().toString();
      const note: Note = {
        _id: noteId,
        title,
        subject,
        description,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: req.user._id,
        downloads: 0,
        rating: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      notes.set(noteId, note);

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
      
      let filteredNotes = Array.from(notes.values());
      
      if (subject && subject !== 'all') {
        filteredNotes = filteredNotes.filter(note => note.subject === subject);
      }
      
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        filteredNotes = filteredNotes.filter(note => 
          note.title.toLowerCase().includes(searchTerm) ||
          (note.description && note.description.toLowerCase().includes(searchTerm))
        );
      }

      // Sort by creation date (newest first)
      filteredNotes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const paginatedNotes = filteredNotes.slice(startIndex, startIndex + Number(limit));

      // Add user information
      const notesWithUsers = paginatedNotes.map(note => ({
        ...note,
        uploadedBy: {
          _id: note.uploadedBy,
          username: users.get(note.uploadedBy)?.username || 'Unknown',
          email: users.get(note.uploadedBy)?.email || ''
        }
      }));

      res.json({
        notes: notesWithUsers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filteredNotes.length,
          pages: Math.ceil(filteredNotes.length / Number(limit))
        }
      });
    } catch (error) {
      console.error("Get notes error:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.get("/api/notes/:id/download", verifyToken, async (req: any, res) => {
    try {
      const note = notes.get(req.params.id);
      
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      const filePath = path.join(__dirname, 'uploads', note.fileName);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }

      // Increment download count
      note.downloads += 1;
      notes.set(req.params.id, note);

      res.download(filePath, note.originalName);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Download failed" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', verifyToken, (req: any, res, next) => {
    // Only authenticated users can access files
    next();
  });

  const httpServer = createServer(app);

  return httpServer;
}
