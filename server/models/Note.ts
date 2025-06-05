import mongoose, { Schema, Document } from 'mongoose';

export interface INote extends Document {
  title: string;
  subject: string;
  description?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: mongoose.Types.ObjectId;
  downloads: number;
  rating: number;
  ratings: Array<{
    userId: mongoose.Types.ObjectId;
    rating: number;
  }>;
}

const NoteSchema = new Schema<INote>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  downloads: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0
  },
  ratings: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    }
  }]
}, {
  timestamps: true
});

// Calculate average rating before saving
NoteSchema.pre('save', function(next) {
  if (this.ratings && this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, curr) => acc + curr.rating, 0);
    this.rating = Math.round((sum / this.ratings.length) * 10) / 10;
  }
  next();
});

export const Note = mongoose.model<INote>('Note', NoteSchema);