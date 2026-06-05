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
  if (status) { 
    updates.status = status; 
    if (status === 'done') updates.completed_at = new Date().toISOString(); 
  }
  if (due_date) updates.due_date = due_date;

  // Track points independently when marking done
  if (status === 'done' && owner_id) {
    try {
      const { data: task } = await supabase.from('tasks').select('points, status').eq('id', req.params.id).single();
      if (task && task.status !== 'done') {
        const pts = task.points || 20;
        const { data: user } = await supabase.from('users').select('earned_points').eq('id', owner_id).single();
        await supabase.from('users').update({ earned_points: (user?.earned_points || 0) + pts }).eq('id', owner_id);
      }
    } catch(e) { console.error('Points tracking error:', e.message); }
  }

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

// PATCH edit task details
router.patch('/:id/edit', async (req, res) => {
  const { title, description, due_date, priority } = req.body;
  try {
    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (due_date) updates.due_date = due_date;
    if (priority) updates.priority = priority;

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Clear research when task is edited
    await supabase.from('task_research').delete().eq('task_id', req.params.id);

    res.json({ success: true, task: data });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH cancel task with reason and points deduction
router.patch('/:id/cancel', async (req, res) => {
  const { reason, cancelled_by } = req.body;
  const NYAGAH_ID = '00000000-0000-0000-0000-000000000001';
  const MUM_ID = '00000000-0000-0000-0000-000000000002';

  try {
    // Get current task
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (taskError || !task) throw new Error('Task not found');

    // Get canceller current points
    const allTasks = await supabase
      .from('tasks')
      .select('*')
      .eq('owner_id', cancelled_by)
      .eq('status', 'done');

    const sharedDone = await supabase
      .from('tasks')
      .select('*')
      .eq('space', 'shared')
      .eq('status', 'done');

    const myPoints = (allTasks.data || []).reduce((a, t) => a + (t.points || 20), 0) +
                     (sharedDone.data || []).reduce((a, t) => a + (t.points || 20), 0);

    // Deduct 5 points only for personal tasks, not shared
    const isShared = task.space === 'shared';
    const deduct = isShared ? 0 : 5;

    if (!isShared && myPoints < 5) {
      return res.json({ success: false, blocked: true, message: 'Not enough points to cancel' });
    }

    // Update task to cancelled
    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        cancel_reason: reason || '',
        points_deducted: deduct
      })
      .eq('id', req.params.id);

    if (error) throw error;

    // Track deducted points independently
    if (deduct > 0 && cancelled_by) {
      try {
        const { data: user } = await supabase.from('users').select('deducted_points').eq('id', cancelled_by).single();
        await supabase.from('users').update({ deducted_points: (user?.deducted_points || 0) + deduct }).eq('id', cancelled_by);
      } catch(e) { console.error('Deduction tracking:', e.message); }
    }

    res.json({ success: true, deducted: deduct });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE task
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
