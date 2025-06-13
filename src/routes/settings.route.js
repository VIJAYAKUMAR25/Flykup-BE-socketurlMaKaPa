import express from 'express';
import { updateAppSettings, getAppSettings } from '../controllers/settings.controller.js';

const router = express.Router();

// Route to update app settings
router.put('/update', updateAppSettings);

// Route to get app settings
router.get('/get', getAppSettings);

export default router;
