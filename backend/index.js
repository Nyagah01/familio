require('dotenv').config();
const express = require('express');
const cors = require('cors');

const tasksRouter = require('./routes/tasks');
const researchRouter = require('./routes/research');
const vibesRouter = require('./routes/vibes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'Familio backend running' });
});

app.use('/tasks', tasksRouter);
app.use('/research', researchRouter);
app.use('/vibes', vibesRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Familio backend running on port ${PORT}`);
});
