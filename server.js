require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// MongoDB connection
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exercisetracker';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log(' MongoDB connected'))
  .catch(err => console.error(' MongoDB connection error:', err));

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }
});
const User = mongoose.model('User', userSchema);

const exerciseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, required: true }
});
const Exercise = mongoose.model('Exercise', exerciseSchema);

// Routes
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// Create user
app.post('/api/users', async (req, res) => {
  try {
    const username = (req.body.username || '').trim();
    if (!username) return res.status(400).json({ error: 'username required' });
    let user = await User.findOne({ username }).exec();
    if (!user) {
      user = new User({ username });
      await user.save();
    }
    res.json({ username: user.username, _id: user._id.toString() });
  } catch (err) {
    if (err.code === 11000) {
      const user = await User.findOne({ username: req.body.username }).exec();
      return res.json({ username: user.username, _id: user._id.toString() });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username _id').exec();
    res.json(users.map(u => ({ username: u.username, _id: u._id.toString() })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const userId = req.params._id;
    const description = (req.body.description || '').trim();
    const duration = Number(req.body.duration);
    const dateString = req.body.date;

    if (!description) return res.status(400).json({ error: 'description required' });
    if (!duration || isNaN(duration)) return res.status(400).json({ error: 'duration required and must be a number' });

    const user = await User.findById(userId).exec();
    if (!user) return res.status(400).json({ error: 'unknown userId' });

    let dateObj = dateString ? new Date(dateString) : new Date();
    if (isNaN(dateObj.getTime())) dateObj = new Date();

    const exercise = new Exercise({
      userId: user._id,
      description,
      duration,
      date: dateObj
    });
    await exercise.save();

    res.json({
      _id: user._id.toString(),
      username: user.username,
      date: exercise.date.toDateString(),
      duration: exercise.duration,
      description: exercise.description
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const userId = req.params._id;
    const { from, to, limit } = req.query;

    const user = await User.findById(userId).exec();
    if (!user) return res.status(400).json({ error: 'unknown userId' });

    const dateFilter = {};
    if (from) {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) dateFilter.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) dateFilter.$lte = toDate;
    }

    const filter = { userId: user._id };
    if (Object.keys(dateFilter).length) filter.date = dateFilter;

    let query = Exercise.find(filter).sort({ date: 'asc' });
    if (limit) {
      const lim = parseInt(limit);
      if (!isNaN(lim) && lim > 0) query = query.limit(lim);
    }

    const exercises = await query.exec();
    const log = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()
    }));

    res.json({
      username: user.username,
      count: log.length,
      _id: user._id.toString(),
      log
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Start
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Server listening on port ${port}`));
