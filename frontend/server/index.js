import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import expeditionRoutes from "./routes/expeditions.js";
import cargoRoutes from "./routes/cargo.js";
import inventoryRoutes from "./routes/inventory.js";
import personnelRoutes from "./routes/personnel.js";
import emergencyRoutes from "./routes/emergencies.js";
import stationRoutes from "./routes/stations.js";
import statsRoutes from "./routes/stats.js";
import auditLogRoutes from "./routes/auditLog.js";
import analyticsRoutes from "./routes/analytics.js";
import assistantRoutes from "./routes/assistant.js";

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/expeditions", expeditionRoutes);
app.use("/api/cargo", cargoRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/personnel", personnelRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/audit-log", auditLogRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/assistant", assistantRoutes);

app.use((req, res) => res.status(404).json({ error: "Not found." }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`PolarOps API listening on http://localhost:${PORT}`);
});
