const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDB } = require('./db');
const Task = require('./models/Task');
const User = require('./models/User');
const auth = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const { Parser } = require('json2csv');
const nodemailer = require('nodemailer');

// Mock email transport for development
const transporter = nodemailer.createTransport({
  streamTransport: true,
  newline: 'windows',
  buffer: true
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database on Startup
initDB();

app.use('/auth', authRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Get all tasks (protected)
app.get('/tasks', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).sort({ created_at: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new task
app.post('/tasks', auth, async (req, res) => {
  const { title, description, reminderDate, priority, category, subtasks } = req.body;
  try {
    const newTask = await Task.create({ 
      title, description, reminderDate, priority, category, subtasks, userId: req.user.id 
    });
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a task status or details
app.put('/tasks/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { status, reminderDate, priority, category, subtasks } = req.body;
  
  const updateData = {};
  if (status !== undefined) updateData.status = status;
  if (priority !== undefined) updateData.priority = priority;
  if (category !== undefined) updateData.category = category;
  if (subtasks !== undefined) updateData.subtasks = subtasks;
  if (reminderDate !== undefined) {
    updateData.reminderDate = reminderDate;
    updateData.reminderSent = false;
  }
  
  try {
    const updatedTask = await Task.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a task
app.delete('/tasks/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const deletedTask = await Task.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export Tasks to CSV
app.get('/export/tasks', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).lean();
    if (tasks.length === 0) {
      return res.status(404).json({ error: 'No tasks to export' });
    }
    const fields = ['title', 'description', 'status', 'priority', 'category', 'reminderDate', 'created_at'];
    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(tasks);
    res.header('Content-Type', 'text/csv');
    res.attachment('tasks.csv');
    return res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cron Job for Reminders (runs every minute)
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const tasksDue = await Task.find({
      reminderDate: { $lte: now },
      reminderSent: false,
      status: { $ne: 'completed' }
    }).populate('userId');

    if (tasksDue.length > 0) {
      console.log(`[REMINDER CRON] Found ${tasksDue.length} tasks due for reminder.`);
      for (let task of tasksDue) {
        console.log(`[REMINDER] Task Due: "${task.title}"`);
        
        // Mock email sending
        if (task.userId && task.userId.email) {
          const info = await transporter.sendMail({
            from: '"NexusTasks" <noreply@nexustasks.com>',
            to: task.userId.email,
            subject: `Reminder: ${task.title}`,
            text: `This is a reminder for your task: ${task.title}\nDescription: ${task.description || ''}`,
          });
          console.log(`[EMAIL MOCK] Email sent to ${task.userId.email}:\n${info.message.toString()}`);
        }

        task.reminderSent = true;
        await task.save();
      }
    }
  } catch (err) {
    console.error('[REMINDER CRON] Error:', err);
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
