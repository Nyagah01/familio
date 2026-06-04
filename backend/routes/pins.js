const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const bcrypt = require('bcryptjs');

const NYAGAH_ID = '00000000-0000-0000-0000-000000000001';
const MUM_ID = '00000000-0000-0000-0000-000000000002';

// POST /pins/verify - check if PIN is correct
router.post('/verify', async (req, res) => {
  const { user_id, pin } = req.body;
  try {
    const { data, error } = await supabase
      .from('pins')
      .select('pin')
      .eq('user_id', user_id)
      .single();

    if (error || !data) return res.json({ valid: false });

    const valid = await bcrypt.compare(pin, data.pin);
    res.json({ valid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /pins/change - change your own PIN
router.post('/change', async (req, res) => {
  const { user_id, current_pin, new_pin } = req.body;
  try {
    const { data, error } = await supabase
      .from('pins')
      .select('pin')
      .eq('user_id', user_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(current_pin, data.pin);
    if (!valid) return res.json({ success: false, error: 'Current PIN is wrong' });

    const hashed = await bcrypt.hash(new_pin, 10);
    await supabase.from('pins').update({ pin: hashed, updated_at: new Date() }).eq('user_id', user_id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /pins/reset - Nyagah resets Mum's PIN (admin only)
router.post('/reset', async (req, res) => {
  const { admin_id, target_user_id, new_pin } = req.body;
  if (admin_id !== NYAGAH_ID) return res.status(403).json({ error: 'Only Nyagah can reset PINs' });
  try {
    const hashed = await bcrypt.hash(new_pin, 10);
    await supabase.from('pins').upsert({ user_id: target_user_id, pin: hashed, updated_at: new Date() });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /pins/setup - hash and store initial PINs (run once)
router.post('/setup', async (req, res) => {
  try {
    const pairs = [
      { user_id: NYAGAH_ID, pin: req.body.nyagah_pin || '7890' },
      { user_id: MUM_ID, pin: req.body.mum_pin || '0987' }
    ];
    for (var p of pairs) {
      const hashed = await bcrypt.hash(p.pin, 10);
      await supabase.from('pins').upsert({ user_id: p.user_id, pin: hashed, updated_at: new Date() });
    }
    res.json({ success: true, message: 'PINs hashed and stored' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
