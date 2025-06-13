import express from "express";
import { createAdmin, loginAdmin, getAdmins, updateAdmin, deleteAdmin } from "../../controllers/admin/admin.controller.js";

const router = express.Router();


router.post("/register", createAdmin);

router.post("/login", loginAdmin);

router.get("/", getAdmins);

router.put("/:id", updateAdmin);

router.delete("/:id", deleteAdmin);


export default router;