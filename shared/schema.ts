import { z } from "zod";

// MongoDB User Schema
export const insertUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['user', 'admin']).default('user'),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// Notes Schema
export const insertNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  subject: z.string().min(1, "Subject is required"),
  description: z.string().optional(),
  fileName: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  _id: string;
  title: string;
  subject: string;
  description?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
