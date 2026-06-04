const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

// GET all tasks (optionally filter by space)
router.get('/', async (req, res) => {
  const { space } = req.query;

  let query = supabase
    .from('tasks')
    .select(`
      *,
      users!tasks_owner_id_fkey (id, name, avatar),
      task_research (id, summary, created_at)
    `)
    .order('created_at', { ascending: false });

  if (space) query = query.eq('space', space);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET single task
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      users!tasks_owner_id_fkey (id, name, avatar),
      task_research (id, summary, created_at)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Task not found' });
  res.json(data);
});

// POST create task
router.post('/', async (req, res) => {
  const { title, description, space, owner_id, priority, due_date, is_private, points } = req.body;

  if (!title || !space || !owner_id || !due_date) {
    return res.status(400).json({ error: 'title, space, owner_id and due_date are required' });
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert([{ title, description, space, owner_id, priority, due_date, is_private: is_private || false, points: points || 20 }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Log activity
  await supabase.from('activity_log').insert([{
    user_id: owner_id,
    task_id: data.id,
    action: 'task_created',
    points_earned: 0,
  }]);

  res.status(201).json(data);
});

// PATCH update task status and/or due date
router.patch('/:id/status', async (req, res) => {
  const { status, owner_id, due_date } = req.body;

  const updates = {};
  if (status) { updates.status = status; if (status === 'done') updates.completed_at = new Date().toISOString(); }
  if (due_date) updates.due_date = due_date;

  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Award points on completion
  if (status === 'done' && owner_id) {
    const points = data.points || 20;
    await supabase.from('users').update({ points: supabase.rpc('increment', { x: points }) }).eq('id', owner_id);
    await supabase.from('activity_log').insert([{
      user_id: owner_id,
      task_id: data.id,
      action: 'task_completed',
      points_earned: points,
    }]);
  }

  res.json(data);
});

// DELETE task
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
