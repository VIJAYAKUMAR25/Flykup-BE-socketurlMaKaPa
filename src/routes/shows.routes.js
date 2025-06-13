import express from 'express';
import {
  createShow,
  getAllShows,
  getShowById,
  updateShow,
  deleteShow,
  getShowsBySeller,
  startShow,
  endShow,
  cancelShow,
  getLiveShows,
  viewShowDetails,
} from '../controllers/shows.controller.js';

const router = express.Router();

// Create a new show
router.post('/create', createShow);

// Get all shows
router.get('/get', getAllShows);

// Get a single show by ID
router.get('/get/:id', getShowById);

// Update a show by ID
router.put('/update/:id', updateShow);

// Delete a show by ID
router.delete('/delete/:id', deleteShow);

// get seller shows 
router.get('/seller/:id', getShowsBySeller);

// start show 
router.patch('/:showId/start',startShow);

// end show 
router.patch('/:showId/end',endShow);

// cencel show 
router.patch('/:showId/cancel',cancelShow);

// get live shows
router.get('/live', getLiveShows);

// view show details by show id
router.get('/view/:id', viewShowDetails);

export default router;