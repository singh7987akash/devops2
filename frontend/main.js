const API_URL = 'http://localhost:5000/tasks';
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

if (!token) {
  window.location.href = '/auth.html';
}

const user = JSON.parse(userStr || '{}');
let tasks = [];
let currentFilter = 'all';
let currentSearch = '';

// DOM Elements
const userNameDisplay = document.getElementById('userNameDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const themeToggle = document.getElementById('themeToggle');
const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskDescription = document.getElementById('taskDescription');
const taskReminder = document.getElementById('taskReminder');
const taskPriority = document.getElementById('taskPriority');
const taskCategory = document.getElementById('taskCategory');
const taskSubtasks = document.getElementById('taskSubtasks');
const taskList = document.getElementById('taskList');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchInput');
const exportBtn = document.getElementById('exportBtn');
const viewBtns = document.querySelectorAll('.view-btn');
const viewSections = document.querySelectorAll('.view-section');

const kanbanPending = document.getElementById('kanbanPending');
const kanbanCompleted = document.getElementById('kanbanCompleted');
const calendarEl = document.getElementById('calendar');

let calendar;

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  if (user.name) userNameDisplay.textContent = `Welcome, ${user.name}`;
  
  // Theme
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }

  fetchTasks();
  initCalendar();
  initKanban();
});

if ('Notification' in window) {
  Notification.requestPermission();
}

// Event Listeners
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/auth.html';
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = taskTitle.value.trim();
  const description = taskDescription.value.trim();
  const reminderDateRaw = taskReminder.value;
  const reminderDate = reminderDateRaw ? new Date(reminderDateRaw).toISOString() : null;
  const priority = taskPriority.value;
  const category = taskCategory.value.trim() || 'General';
  const subtasksRaw = taskSubtasks.value.trim();
  
  let subtasks = [];
  if (subtasksRaw) {
    subtasks = subtasksRaw.split(',').map(s => ({ title: s.trim(), completed: false })).filter(s => s.title);
  }
  
  if (title) {
    await addTask({ title, description, reminderDate, priority, category, subtasks });
    taskForm.reset();
  }
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    currentFilter = e.target.dataset.filter;
    renderAllViews();
  });
});

searchInput.addEventListener('input', (e) => {
  currentSearch = e.target.value.toLowerCase();
  renderAllViews();
});

exportBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('http://localhost:5000/export/tasks', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tasks.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
  }
});

viewBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    viewBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    const view = e.target.dataset.view;
    
    viewSections.forEach(sec => sec.style.display = 'none');
    document.getElementById(`${view}View`).style.display = 'block';
    
    if (view === 'calendar') {
      calendar.render();
    }
  });
});

// API Calls
async function fetchTasks() {
  try {
    const response = await fetch(API_URL, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth.html';
      return;
    }
    if (!response.ok) throw new Error('Failed to fetch tasks');
    tasks = await response.json();
    renderAllViews();
  } catch (error) {
    console.error('Error fetching tasks:', error);
    taskList.innerHTML = '<p style="text-align:center; color: var(--danger);">Failed to load tasks.</p>';
  }
}

async function addTask(payload) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to add task');
    const newTask = await response.json();
    tasks.unshift(newTask);
    renderAllViews();
  } catch (error) {
    console.error('Error adding task:', error);
  }
}

window.toggleTaskStatus = async (id, currentStatus) => {
  const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
  updateTask(id, { status: newStatus });
};

window.deleteTask = async (id) => {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete task');
    tasks = tasks.filter(t => t.id !== id);
    renderAllViews();
  } catch (error) {
    console.error('Error deleting task:', error);
  }
};

window.toggleSubtask = async (taskId, subtaskId, isCompleted) => {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  
  const subtasks = task.subtasks.map(st => {
    if (st._id === subtaskId) {
      return { ...st, completed: !isCompleted };
    }
    return st;
  });
  
  updateTask(taskId, { subtasks });
};

async function updateTask(id, updateData) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error('Failed to update task');
    const updatedTask = await response.json();
    tasks = tasks.map(t => t.id === id ? updatedTask : t);
    renderAllViews();
  } catch (error) {
    console.error('Error updating task:', error);
  }
}

// Render Logic
function getFilteredTasks() {
  return tasks.filter(task => {
    const matchesFilter = currentFilter === 'all' || task.status === currentFilter;
    const matchesSearch = task.title.toLowerCase().includes(currentSearch) || 
                         (task.description && task.description.toLowerCase().includes(currentSearch)) ||
                         (task.category && task.category.toLowerCase().includes(currentSearch));
    return matchesFilter && matchesSearch;
  });
}

function renderAllViews() {
  renderList();
  renderKanban();
  updateCalendar();
}

function createTaskCardHTML(task, isKanban = false) {
  const isCompleted = task.status === 'completed';
  const reminderHtml = task.reminderDate ? `<div class="task-reminder" style="font-size: 0.8rem; color: var(--accent); margin-top: 0.25rem;">⏰ ${new Date(task.reminderDate).toLocaleString()}</div>` : '';
  
  const priorityClass = task.priority === 'high' ? 'tag-priority-high' : task.priority === 'low' ? 'tag-priority-low' : '';
  const categoryHtml = `<div class="tags">
    <span class="tag-badge ${priorityClass}">${task.priority.toUpperCase()}</span>
    <span class="tag-badge">${escapeHTML(task.category)}</span>
  </div>`;

  let subtasksHtml = '';
  if (task.subtasks && task.subtasks.length > 0) {
    subtasksHtml = '<div class="subtasks-list">';
    task.subtasks.forEach(st => {
      subtasksHtml += `
        <div class="subtask-item">
          <input type="checkbox" ${st.completed ? 'checked' : ''} onclick="toggleSubtask('${task.id}', '${st._id}', ${st.completed})">
          <span style="${st.completed ? 'text-decoration:line-through;opacity:0.6' : ''}">${escapeHTML(st.title)}</span>
        </div>`;
    });
    subtasksHtml += '</div>';
  }

  return `
    <div class="task-content">
      <div class="task-title">${escapeHTML(task.title)}</div>
      ${task.description ? `<div class="task-desc">${escapeHTML(task.description)}</div>` : ''}
      ${categoryHtml}
      ${subtasksHtml}
      ${reminderHtml}
    </div>
    <div class="task-actions" ${isKanban ? 'style="margin-top:1rem;"' : ''}>
      <button class="action-btn complete" onclick="toggleTaskStatus('${task.id}', '${task.status}')" title="${isCompleted ? 'Mark Pending' : 'Mark Complete'}">
        ${isCompleted ? '↺' : '✓'}
      </button>
      <button class="action-btn delete" onclick="deleteTask('${task.id}')" title="Delete Task">
        ✕
      </button>
    </div>
  `;
}

function renderList() {
  taskList.innerHTML = '';
  const filteredTasks = getFilteredTasks();

  if (filteredTasks.length === 0) {
    taskList.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">No tasks found.</p>';
    return;
  }

  filteredTasks.forEach(task => {
    const isCompleted = task.status === 'completed';
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${isCompleted ? 'completed' : ''}`;
    taskEl.innerHTML = createTaskCardHTML(task);
    taskList.appendChild(taskEl);
  });
}

// Kanban Logic
function initKanban() {
  if (typeof Sortable !== 'undefined') {
    const options = {
      group: 'kanban',
      animation: 150,
      onEnd: function (evt) {
        const itemEl = evt.item;
        const newStatus = evt.to.dataset.status;
        const taskId = itemEl.dataset.id;
        const task = tasks.find(t => t.id === taskId);
        
        if (task && task.status !== newStatus) {
          updateTask(taskId, { status: newStatus });
        }
      }
    };
    new Sortable(kanbanPending, options);
    new Sortable(kanbanCompleted, options);
  }
}

function renderKanban() {
  kanbanPending.innerHTML = '';
  kanbanCompleted.innerHTML = '';
  const filteredTasks = getFilteredTasks();

  filteredTasks.forEach(task => {
    const isCompleted = task.status === 'completed';
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${isCompleted ? 'completed' : ''}`;
    taskEl.style.flexDirection = 'column';
    taskEl.style.alignItems = 'stretch';
    taskEl.style.cursor = 'grab';
    taskEl.dataset.id = task.id;
    taskEl.innerHTML = createTaskCardHTML(task, true);
    
    if (isCompleted) {
      kanbanCompleted.appendChild(taskEl);
    } else {
      kanbanPending.appendChild(taskEl);
    }
  });
}

// Calendar Logic
function initCalendar() {
  if (typeof FullCalendar !== 'undefined') {
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek'
      },
      events: []
    });
    calendar.render();
  }
}

function updateCalendar() {
  if (!calendar) return;
  const filteredTasks = getFilteredTasks();
  
  const events = filteredTasks.filter(t => t.reminderDate).map(t => ({
    id: t.id,
    title: t.title,
    start: t.reminderDate,
    color: t.priority === 'high' ? '#ef4444' : t.priority === 'low' ? '#10b981' : '#6366f1',
    className: t.status === 'completed' ? 'calendar-completed' : ''
  }));
  
  calendar.removeAllEvents();
  calendar.addEventSource(events);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
