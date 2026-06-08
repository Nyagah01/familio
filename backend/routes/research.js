const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const supabase = require('../lib/supabase');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /research/:taskId - trigger AI research for a task
router.post('/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { requested_by } = req.body;

  // Fetch the task
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (taskError || !task) return res.status(404).json({ error: 'Task not found' });

  try {
    // Ask Claude to research the task using web search
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [
        {
          role: 'user',
          content: `You are a helpful family assistant. Research this task and give a concise, friendly, and genuinely useful response.

Task: "${task.title}"
Details: "${task.description || 'No additional details'}"
Due: ${task.due_date}

Instructions:
- Search the web for real, current information relevant to this task
- If it's about finding a place, service, or product: list 3-5 specific options with key details (price, location, rating, contact if available)
- If it's about making something (food, craft etc): give a concise how-to or recipe
- If it's a reminder task: give helpful tips to complete it
- Keep the tone warm and helpful, like a knowledgeable friend
- Format the response clearly with line breaks
- End with one practical next step they can take right now

Keep it under 300 words.`
        }
      ]
    });

    // Extract text from response
    const summary = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Save research result to DB
    const { data: research, error: researchError } = await supabase
      .from('task_research')
      .insert([{
        task_id: taskId,
        summary,
        raw_result: JSON.stringify(message.content),
        requested_by,
      }])
      .select()
      .single();

    if (researchError) return res.status(500).json({ error: researchError.message });

    res.json({ success: true, research });

  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: 'AI research failed', details: err.message });
  }
});

// GET /research/:taskId - get existing research for a task
router.get('/:taskId', async (req, res) => {
  const { data, error } = await supabase
    .from('task_research')
    .select('*')
    .eq('task_id', req.params.taskId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

module.exports = router;
