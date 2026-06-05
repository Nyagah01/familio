const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// GET /history/:userId - fetch done and cancelled tasks for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // My personal done/cancelled tasks
    const { data: myTasks, error: myError } = await supabase
      .from('tasks')
      .select('*')
      .eq('owner_id', userId)
      .in('status', ['done', 'cancelled', 'archived'])
      .neq('space', 'shared')
      .order('updated_at', { ascending: false });

    if (myError) throw myError;

    // Shared done/cancelled tasks
    const { data: sharedTasks, error: sharedError } = await supabase
      .from('tasks')
      .select('*')
      .eq('space', 'shared')
      .in('status', ['done', 'cancelled', 'archived'])
      .order('updated_at', { ascending: false });

    if (sharedError) throw sharedError;

    res.json({ my: myTasks || [], shared: sharedTasks || [] });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
