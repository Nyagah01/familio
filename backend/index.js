require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const tasksRouter = require('./routes/tasks');
const researchRouter = require('./routes/research');
const vibesRouter = require('./routes/vibes');
const { router: remindersRouter, runDailyReminders } = require('./routes/reminders');
const pinsRouter = require('./routes/pins');

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
