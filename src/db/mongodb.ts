import mongoose from "mongoose";

export async function connectMongoDB() {
  const uri = process.env.MONGODB_ATLAS_URI;
  if (!uri || mongoose.connection.readyState !== 0) return;
  await mongoose.connect(uri);
  console.log("Connected to MongoDB Atlas");
}

const documentSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, default: "Untitled Document" },
  content: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const MongoDocumentModel = mongoose.models.Document ||
  mongoose.model("Document", documentSchema);
