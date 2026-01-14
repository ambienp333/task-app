// Supabase setup
const SUPABASE_URL = 'https://igsbvuevpfkvfyesabro.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlnc2J2dWV2cGZrdmZ5ZXNhYnJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNTkyNDcsImV4cCI6MjA4MzkzNTI0N30.8NtHxvyE22VVkKfMf5mlUWgLIzl9l88JDoRSx47eHL4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Single user ID for all devices
const userId = 'abel_main_user';

// State management
let tasks = {
    active: [],
    recurring: [],
    done: []
};

let currentViewIndex = 0;
let isAnimating = false;
const views = Array.from({length: 6}, (_, i) => document.getElementById(`view-${i}`));
const viewPositions = [0, 1, 2, 3, 4, 5];
const backgroundLayer = document.getElementById('background-layer');

const backgroundColors = {
    'active': '#1e1e1f',
    'recurring': '#251e21',
    'done': '#2d1e1e'
};

// UI Elements
const editBtn = document.getElementById('edit-btn');
const addTaskOverlay = document.getElementById('add-task-overlay');
const manageTasksOverlay = document.getElementById('manage-tasks-overlay');
const taskNameInput = document.getElementById('task-name-input');
const urgentCheckbox = document.getElementById('urgent-checkbox');
const colorSelectContainer = document.getElementById('color-select-container');
const colorSelect = document.getElementById('color-select');
const allDaysCheckbox = document.getElementById('all-days-checkbox');
const daysSelectContainer = document.getElementById('days-select-container');
const allTimeCheckbox = document.getElementById('all-time-checkbox');
const timeSelectContainer = document.getElementById('time-select-container');
const startTimeInput = document.getElementById('start-time-input');
const endTimeInput = document.getElementById('end-time-input');
const saveTaskBtn = document.getElementById('save-task-btn');
const manageTasksBtn = document.getElementById('manage-tasks-btn');
const cancelAddBtn = document.getElementById('cancel-add-btn');
const closeManageBtn = document.getElementById('close-manage-btn');

// Denver timezone utilities
function getDenverTime() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }));
}

function getDenverDayOfWeek() {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return days[getDenverTime().getDay()];
}

function getDenverTimeString() {
    const time = getDenverTime();
    return time.getHours().toString().padStart(2, '0') + ':' + time.getMinutes().toString().padStart(2, '0');
}

function isTaskVisibleNow(task) {
    // Check days
    if (!task.days_enabled) {
        const currentDay = getDenverDayOfWeek();
        if (!task.days.includes(currentDay)) {
            return false;
        }
    }
    
    // Check time
    if (!task.time_enabled && task.start_time && task.end_time) {
        const currentTime = getDenverTimeString();
        if (currentTime < task.start_time || currentTime > task.end_time) {
            return false;
        }
    }
    
    return true;
}

// Load tasks from Supabase
async function loadTasks() {
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error loading tasks:', error);
        return;
    }
    
    // Organize tasks by list_type
    tasks.active = data.filter(t => t.list_type === 'active');
    tasks.recurring = data.filter(t => t.list_type === 'recurring');
    tasks.done = data.filter(t => t.list_type === 'done');
}

// Save task to Supabase
async function saveTask(task) {
    const { error } = await supabaseClient
        .from('tasks')
        .insert([{ ...task, user_id: userId }]);
    
    if (error) {
        console.error('Error saving task:', error);
    }
}

// Update task in Supabase
async function updateTask(taskId, updates) {
    const { error } = await supabaseClient
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error updating task:', error);
    }
}

// Delete task from Supabase
async function deleteTask(taskId) {
    const { error } = await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', userId);
    
    if (error) {
        console.error('Error deleting task:', error);
    }
}

// Render view
function renderView(viewIndex) {
    const view = views[viewIndex];
    const type = view.dataset.type;
    const container = document.getElementById(`tasks-${viewIndex}`);
    container.innerHTML = '';
    
    if (type === 'active') {
        tasks.active.filter(isTaskVisibleNow).forEach((task, index) => {
            const taskEl = createTaskElement(task, 'active', index);
            container.appendChild(taskEl);
        });
    } else if (type === 'recurring') {
        const visibleRecurring = tasks.recurring.filter(isTaskVisibleNow);
        const shuffled = shuffleRecurring(visibleRecurring);
        shuffled.forEach((task, index) => {
            const taskEl = createTaskElement(task, 'recurring', index, shuffled.length);
            container.appendChild(taskEl);
        });
    } else if (type === 'done') {
        tasks.done.filter(isTaskVisibleNow).forEach((task, index) => {
            const taskEl = createTaskElement(task, 'done', index);
            container.appendChild(taskEl);
        });
    }
}

// Render all views
async function renderAllViews() {
    await loadTasks();
    views.forEach((_, index) => renderView(index));
}

// Create task element
function createTaskElement(task, listType, index, totalRecurring = 0) {
    const div = document.createElement('div');
    div.className = `task ${task.category}`;
    div.textContent = task.name;
    
    if (listType === 'recurring' && totalRecurring > 0) {
        const opacity = 1 - (index / totalRecurring) * 0.6;
        div.style.opacity = opacity;
    }
    
    if (listType === 'active') {
        div.addEventListener('click', async () => {
            await updateTask(task.id, { list_type: 'done' });
            await renderAllViews();
        });
    }
    
    return div;
}

// Shuffle recurring
function shuffleRecurring(recurringTasks) {
    if (recurringTasks.length === 0) return [];
    const shuffled = [...recurringTasks];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Get current visible view type
function getCurrentViewType() {
    const currentView = views.find((_, index) => viewPositions[index] === currentViewIndex);
    return currentView ? currentView.dataset.type : 'active';
}

// Update background color
function updateBackgroundColor() {
    const type = getCurrentViewType();
    const targetColor = backgroundColors[type];
    backgroundLayer.style.backgroundColor = targetColor;
}

// Update view positions
function updatePositions() {
    views.forEach((view, index) => {
        const position = viewPositions[index];
        const offset = (position - currentViewIndex) * 100;
        view.style.transform = `translateY(${offset}vh)`;
        
        if (Math.abs(position - currentViewIndex) > 2) {
            view.style.opacity = '0';
        } else {
            view.style.opacity = '1';
        }
    });
}

// Cycle to next view
function cycleView() {
    if (isAnimating) return;
    isAnimating = true;
    
    currentViewIndex++;
    updatePositions();
    updateBackgroundColor();
    
    // Always unlock after full animation completes
    setTimeout(() => {
        isAnimating = false;
    }, 550);
    
    setTimeout(() => {
        views.forEach((view, index) => {
            const position = viewPositions[index];
            
            if (position < currentViewIndex - 2) {
                view.style.transition = 'none';
                view.style.opacity = '0';
                
                viewPositions[index] = currentViewIndex + 3;
                view.offsetHeight;
                
                const offset = (viewPositions[index] - currentViewIndex) * 100;
                view.style.transform = `translateY(${offset}vh)`;
                
                setTimeout(() => {
                    view.style.transition = 'transform 500ms ease-in-out';
                    view.style.opacity = '1';
                }, 50);
            }
        });
    }, 500);
}

// Editor UI handlers
editBtn.addEventListener('click', () => {
    addTaskOverlay.classList.remove('hidden');
    taskNameInput.value = '';
    urgentCheckbox.checked = false;
    colorSelectContainer.style.display = 'block';
    allDaysCheckbox.checked = true;
    daysSelectContainer.style.display = 'none';
    allTimeCheckbox.checked = true;
    timeSelectContainer.style.display = 'none';
    document.querySelector('input[name="task-type"][value="oneoff"]').checked = true;
});

urgentCheckbox.addEventListener('change', () => {
    colorSelectContainer.style.display = urgentCheckbox.checked ? 'none' : 'block';
});

allDaysCheckbox.addEventListener('change', () => {
    daysSelectContainer.style.display = allDaysCheckbox.checked ? 'none' : 'block';
});

allTimeCheckbox.addEventListener('change', () => {
    timeSelectContainer.style.display = allTimeCheckbox.checked ? 'none' : 'block';
});

saveTaskBtn.addEventListener('click', async () => {
    const name = taskNameInput.value.trim();
    if (!name) return;
    
    const isUrgent = urgentCheckbox.checked;
    const category = isUrgent ? 'urgent' : colorSelect.value;
    const type = document.querySelector('input[name="task-type"]:checked').value;
    
    const days_enabled = allDaysCheckbox.checked;
    const days = days_enabled ? ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] : 
        Array.from(document.querySelectorAll('input[name="day"]:checked')).map(el => el.value);
    
    const time_enabled = allTimeCheckbox.checked;
    const start_time = time_enabled ? null : startTimeInput.value;
    const end_time = time_enabled ? null : endTimeInput.value;
    
    const newTask = {
        name: name,
        category: category,
        type: type,
        list_type: type === 'recurring' ? 'recurring' : 'active',
        days_enabled: days_enabled,
        days: days,
        time_enabled: time_enabled,
        start_time: start_time,
        end_time: end_time
    };
    
    await saveTask(newTask);
    await renderAllViews();
    addTaskOverlay.classList.add('hidden');
});

cancelAddBtn.addEventListener('click', () => {
    addTaskOverlay.classList.add('hidden');
});

manageTasksBtn.addEventListener('click', async () => {
    await renderManageTasksList();
    manageTasksOverlay.classList.remove('hidden');
});

closeManageBtn.addEventListener('click', () => {
    manageTasksOverlay.classList.add('hidden');
});

// Render manage tasks list
async function renderManageTasksList() {
    await loadTasks();
    const container = document.getElementById('manage-tasks-list');
    container.innerHTML = '';
    
    const allTasks = [
        ...tasks.active.map(t => ({...t, listType: 'active'})),
        ...tasks.recurring.map(t => ({...t, listType: 'recurring'})),
        ...tasks.done.map(t => ({...t, listType: 'done'}))
    ];
    
    if (allTasks.length === 0) {
        container.innerHTML = '<p>No tasks yet.</p>';
        return;
    }
    
    allTasks.forEach((task) => {
        const item = document.createElement('div');
        item.className = 'manage-task-item';
        
        const daysText = task.days_enabled ? 'All days' : task.days.join(', ');
        const timeText = task.time_enabled ? 'All times' : `${task.start_time} - ${task.end_time}`;
        
        item.innerHTML = `
            <h3 class="${task.category}">${task.name}</h3>
            <p>Category: ${task.category}</p>
            <p>Type: ${task.type}</p>
            <p>List: ${task.listType}</p>
            <p>Days: ${daysText}</p>
            <p>Time: ${timeText}</p>
            <button class="secondary-btn delete-task-btn" data-id="${task.id}">Delete</button>
        `;
        container.appendChild(item);
    });
    
    // Add delete handlers
    document.querySelectorAll('.delete-task-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const taskId = e.target.dataset.id;
            await deleteTask(taskId);
            await renderAllViews();
            await renderManageTasksList();
        });
    });
}

// Touch handling
let touchStartY = 0;
document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const swipeDistance = touchStartY - touchEndY;
    
    if (swipeDistance > 50) {
        cycleView();
    }
});

// Keyboard
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && addTaskOverlay.classList.contains('hidden') && manageTasksOverlay.classList.contains('hidden')) {
        e.preventDefault();
        cycleView();
    }
});

// Refresh views every minute to update time-based visibility
setInterval(renderAllViews, 60000);

// Initialize
(async () => {
    await renderAllViews();
    updatePositions();
    updateBackgroundColor();
})();
