import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';

const router = express.Router();

// Route to create a new category
router.post('/create', createCategory);

// Route to get all categories
router.get('/get', getCategories);

// Route to get a specific category by ID
router.get('/get/:id', getCategoryById);

// Route to update a specific category by ID
router.put('/update/:id', updateCategory);

// Route to delete a specific category by ID
router.delete('/delete/:id', deleteCategory);

export default router;
