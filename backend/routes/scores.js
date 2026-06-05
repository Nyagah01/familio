const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// GET /scores - get persistent points for both users
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, earned_points, deducted_points')
      .in('id', ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']);
    if (error) throw error;
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
