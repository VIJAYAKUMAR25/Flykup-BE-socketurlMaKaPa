import Express from 'express';
import { endLiveStream, getActiveStreams, getMillicastToken, getStreamAccessToken, startLiveStream } from '../controllers/liveStream.controller.js';


const liveStreamRouter = Express.Router();

// Start a new stream
liveStreamRouter.post("/",startLiveStream);

// Get active streams
liveStreamRouter.get("/active", getActiveStreams);

// End a stream
liveStreamRouter.patch("/:id/end", endLiveStream);

// get access token
liveStreamRouter.get("/token/:streamName", getStreamAccessToken);

// get millicast token 
liveStreamRouter.post("/get-millicast-token", getMillicastToken);

export default liveStreamRouter;