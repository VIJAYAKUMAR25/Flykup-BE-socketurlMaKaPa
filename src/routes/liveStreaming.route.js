import Express from 'express';
import { generateLiveStramingAccessToken } from '../controllers/liveStreaming.controller.js';

const liveStreamRouter = Express.Router();

liveStreamRouter.post("/get-token", generateLiveStramingAccessToken);

export default liveStreamRouter;