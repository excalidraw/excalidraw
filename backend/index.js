const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;
const multer = require("multer");
const upload = multer({ dest: "uploads/" });  // saves files to uploads/ folder


app.use(cors());
app.use(express.json());

// Mock endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, world!', success: true });
});

app.post("/terraform/upload", upload.fields([
  { name: "planFile", maxCount: 1 },
  { name: "dotFile", maxCount: 1 },
]), (req, res) => {
  const fs = require("fs");
  const planFile = req.files["planFile"]?.[0];
  const dotFile = req.files["dotFile"]?.[0];

  if (!planFile || !dotFile) {
    return res.status(400).json({ error: "Both planFile and dotFile are required" });
  }

  const planContent = fs.readFileSync(planFile.path, "utf-8");
  const dotContent = fs.readFileSync(dotFile.path, "utf-8");

  console.log("Plan file:", planFile.originalname, planContent.length, "chars");
  console.log("Dot file:", dotFile.originalname, dotContent.length, "chars");

  res.json({
    success: true,
    plan: { name: planFile.originalname, size: planContent.length },
    dot: { name: dotFile.originalname, size: dotContent.length },
  });
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});