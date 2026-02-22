const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// Mock endpoint
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, world!', success: true });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});