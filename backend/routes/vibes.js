const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// GET vibes - fetch all vibes (for both users to see)
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vibes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST vibe - log a new vibe
router.post('/', async (req, res) => {
  try {
    const { user_id, level, label, emoji, color, low, note } = req.body;
    const { data, error } = await supabase
      .from('vibes')
      .insert([{ user_id, level, label, emoji, color, low, note: note || '' }])
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, vibe: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE all vibes for a user
router.delete('/clear/:userId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('vibes')
      .delete()
      .eq('user_id', req.params.userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
