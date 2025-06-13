import mongoose from "mongoose";

const liveStreamSchema = new mongoose.Schema({
    streamName: { type: String, unique: true, required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    title: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    startedAt: { type: Date, default: Date.now }
  });
  
 const LiveStream  = mongoose.model('livestream', liveStreamSchema);

 export default LiveStream;