import LiveStream from "../models/liveStream.model.js";
// import jwt from 'jsonwebtoken';
import streamingApis from '@api/streaming-apis';
import axios from "axios";
const MILLICAST_ACCOUNT_ID = process.env.MILLICAST_ACCOUNT_ID;
const TOKEN_SECRET = process.env.MILLICAST_TOKEN_SECRET;

const API_TOKEN = '76b7c5f70077d95bb1acf1bd308902f4fed1e755817a94dc64e5298066ec2b03'; 

export const startLiveStream = async ( req, res ) => {

    const { sellerId , title } = req.body;

      try {
        const streamName = `stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        const stream = new LiveStream({
          streamName,
          sellerId,
          title,
        });
    
        await stream.save();
        res.status(201).json({status: true, message:"Stream started successfully!", data: streamName });
      } catch (error) {
        console.log("Error in startLiveStream:", error.message)
        res.status(500).json({status: false, message: "Internal server Error" });
      }
}

export const endLiveStream = async(req,res) => {

    const { id } = req.params;

    try {
        const stream = await LiveStream.findByIdAndUpdate(
            id,
          { status: 'inactive' },
          { new: true }
        );
        res.status(200).json({status: true, message:"live stream ended successfully!",data:stream});
      } catch (error) {
        console.log("Error in endLiveStream:", error.message)
        res.status(500).json({status: false, message: "Internal server Error" });
      }
}

export const getActiveStreams = async (req,res) => {
    try {
        const streams = await LiveStream.find({ status: 'active' }).populate('sellerId', 'basicInfo.name');
        res.status(200).json({status: true, message:"fetched active steams successfully!",data:streams});
      } catch (error) {
        console.log("Error in getActiveStreams:", error.message)
        res.status(500).json({status: false, message: "Internal server Error" });
      }
}

export const getStreamAccessToken = async (req,res) => {
    const { streamName } = req.params;
    try {
        // Validate permissions
        const stream = await LiveStream.findOne({ streamName });
        if (!stream) return res.status(404).send('Stream not found');
    
        // Create JWT token with expiration
        const token = jwt.sign(
          {
            streamName,
            exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
          },
          TOKEN_SECRET
        );
    
        res.json({
          token,
          accountId: MILLICAST_ACCOUNT_ID
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
}
const MILLICAST_API_URL = 'https://api.millicast.com';

export const getMillicastToken =async (req, res) => {

  streamingApis.auth('76b7c5f70077d95bb1acf1bd308902f4fed1e755817a94dc64e5298066ec2b03');
streamingApis.publishTokenV1_CreateToken({
  subscribeRequiresAuth: false,
  record: false,
  clip: false,
  multisource: true,
  enableThumbnails: false,
  displaySrtPassphrase: false,
  lowLatencyRtmp: true,
  streams: [{isRegex: true, streamName: 'stream1'}],
  label: 'simple_token'
})
  .then(({ data }) => {
    console.log(data);
    res.status(200).json({status: true, message:"Token generated successfully!",data});
  })
  .catch(err => {
    console.error(err)
    res.status(500).json({status: false, message: "Internal server Error" });
});

  
}