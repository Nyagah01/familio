require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const tasksRouter = require('./routes/tasks');
const researchRouter = require('./routes/research');
const vibesRouter = require('./routes/vibes');
const { router: remindersRouter, runDailyReminders } = require('./routes/reminders');
const pinsRouter = require('./routes/pins');
const historyRouter = require('./routes/history');
const scoresRouter = require('./routes/scores');
const pdfRouter = require('./routes/pdf');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Familio backend running' });
});

app.use('/tasks', tasksRouter);
app.use('/research', researchRouter);
app.use('/vibes', vibesRouter);
app.use('/reminders', remindersRouter);
app.use('/pins', pinsRouter);
app.use('/history', historyRouter);
app.use('/scores', scoresRouter);
app.use('/pdf', pdfRouter);

// Reset streaks at midnight Nairobi time (21:00 UTC previous day)
cron.schedule('0 21 * * *', async () => {
  console.log('Checking streaks...');
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const today = new Date().toISOString().split('T')[0];
    // Reset streak for users who didn't complete anything today
    await sb.from('users').update({ streak: 0 }).neq('last_streak_date', today).gt('streak', 0);
    console.log('Streaks checked');
  } catch(e) { console.error('Streak reset error:', e.message); }
});

// Run reminders every day at 8:00 AM Nairobi time (UTC+3 = 05:00 UTC)
cron.schedule('0 5 * * *', async () => {
  console.log('Running daily reminders...');
  try {
    var result = await runDailyReminders();
    console.log('Reminders sent:', result);
  } catch(e) {
    console.error('Reminder error:', e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Familio backend running on port ${PORT}`);
});
