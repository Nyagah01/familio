const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const FROM = 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER;

const NYAGAH_ID = '00000000-0000-0000-0000-000000000001';
const MUM_ID = '00000000-0000-0000-0000-000000000002';

const USERS = {
  [NYAGAH_ID]: { name: 'Nyagah', phone: 'whatsapp:+254740116371' },
  [MUM_ID]: { name: 'Mum', phone: 'whatsapp:+254720666029' },
};

async function sendReminder(to, message) {
  return client.messages.create({ from: FROM, to, body: message });
}

function daysUntil(dateStr) {
  var due = new Date(dateStr);
  var now = new Date();
  due.setHours(0,0,0,0);
  now.setHours(0,0,0,0);
  return Math.round((due - now) / (1000 * 60 * 60 * 24));
}

async function runDailyReminders() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .in('status', ['pending', 'in_progress']);

  if (error || !tasks) return { sent: 0, error };

  var sent = 0;
  var messages = {};

  tasks.forEach(function(task) {
    // For shared tasks, remind both users. For personal, remind owner only.
    var usersToRemind = [];
    if (task.space === 'shared') {
      usersToRemind = [USERS[NYAGAH_ID], USERS[MUM_ID]];
    } else {
      var owner = USERS[task.owner_id];
      if (owner) usersToRemind = [owner];
    }

    var days = daysUntil(task.due_date);
    var isHigh = task.priority === 'high';

    usersToRemind.forEach(function(user) {
    var msg = null;

    if (days < 0) {
      msg = 'Hey ' + user.name + ', just a nudge from Familio 👋\n\n"' + task.title + '" was due ' + Math.abs(days) + ' day' + (Math.abs(days) !== 1 ? 's' : '') + ' ago and is still pending. Want to sort it out today?';
      if (isHigh) msg += ' This is a HIGH PRIORITY task 🔴';
    } else if (days === 0) {
      msg = 'Hey ' + user.name + ' ⏰\n\n"' + task.title + '" is due TODAY. You got this — knock it out!';
      if (isHigh) msg += ' 🔴 High priority!';
    } else if (days === 1) {
      msg = 'Hey ' + user.name + ', reminder from Familio 🗓️\n\n"' + task.title + '" is due tomorrow. Just a heads up!';
      if (isHigh) msg += ' This one is high priority 🔴';
    } else if (days === 3) {
      msg = 'Hey ' + user.name + ', checking in from Familio 📋\n\n"' + task.title + '" is due in 3 days. Still on track?';
    } else if (days === 7 && isHigh) {
      msg = 'Hey ' + user.name + ' 🔴 High priority heads up from Familio!\n\n"' + task.title + '" is due in 7 days. Get a head start!';
    } else if (days === 5 && isHigh) {
      msg = 'Hey ' + user.name + ', Familio checking in 🔴\n\n"' + task.title + '" is a high priority task due in 5 days. How is it going?';
    }

    if (msg) {
      if (!messages[user.phone]) messages[user.phone] = [];
      messages[user.phone].push(msg);
    }
    }); // end usersToRemind
  });

  for (var phone in messages) {
    var combined = messages[phone].join('\n\n---\n\n');
    try {
      await sendReminder(phone, combined);
      sent++;
    } catch(e) {
      console.error('Failed to send to', phone, e.message);
    }
  }

  return { sent, tasks: tasks.length };
}

// Manual trigger endpoint
router.post('/run', async (req, res) => {
  try {
    var result = await runDailyReminders();
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Easy browser test endpoint
router.get('/test', async (req, res) => {
  try {
    var result = await runDailyReminders();
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Cron trigger endpoint (called by Railway cron or external scheduler)
router.get('/cron', async (req, res) => {
  var secret = req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    var result = await runDailyReminders();
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, runDailyReminders };
