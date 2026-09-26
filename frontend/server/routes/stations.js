import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/", (req, res) => {
  const stations = db.prepare("SELECT * FROM stations ORDER BY name").all();
  res.json({ data: stations });
});

export default router;
