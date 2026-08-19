const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/prompts?module=generate|edit
// Populates the "saved prompt" dropdown. Rows are added directly via SQL
// insert into the `prompts` table — this route just reads them back.
router.get('/', async (req, res) => {
  try {
    const { module: moduleKey } = req.query;
    if (moduleKey && !['generate', 'edit'].includes(moduleKey)) {
      return res.status(400).json({ error: "module must be 'generate' or 'edit'" });
    }
    const rows = await db.listPrompts({ moduleKey });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
