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
let queuedSwipe = false;
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
const temporaryCheckbox = document.getElementById('temporary-checkbox');
const recurringCheckbox = document.getElementById('recurring-checkbox');
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
const clockElement = document.getElementById('clock');
const viewLabelElement = document.getElementById('view-label');

// Edit Task UI Elements
const editTaskOverlay = document.getElementById('edit-task-overlay');
const editTaskNameInput = document.getElementById('edit-task-name-input');
const editUrgentCheckbox = document.getElementById('edit-urgent-checkbox');
const editColorSelectContainer = document.getElementById('edit-color-select-container');
const editColorSelect = document.getElementById('edit-color-select');
const editTemporaryCheckbox = document.getElementById('edit-temporary-checkbox');
const editRecurringCheckbox = document.getElementById('edit-recurring-checkbox');
const editAllDaysCheckbox = document.getElementById('edit-all-days-checkbox');
const editDaysSelectContainer = document.getElementById('edit-days-select-container');
const editAllTimeCheckbox = document.getElementById('edit-all-time-checkbox');
const editTimeSelectContainer = document.getElementById('edit-time-select-container');
const editStartTimeInput = document.getElementById('edit-start-time-input');
const editEndTimeInput = document.getElementById('edit-end-time-input');
const saveEditBtn = document.getElementById('save-edit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

let currentEditingTaskId = null;

// Denver timezone utilities
function getDenverTime() {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Denver',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const parts = formatter.formatToParts(new Date());
    const values = {};
    parts.forEach(part => {
        if (part.type !== 'literal') {
            values[part.type] = parseInt(part.value);
        }
    });
    
    return new Date(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
}

function getDenverDateString() {
    const time = getDenverTime();
    const year = time.getFullYear();
    const month = String(time.getMonth() + 1).padStart(2, '0');
    const day = String(time.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

// Update clock
function updateClock() {
    const time = getDenverTime();
    const hours = time.getHours().toString().padStart(2, '0');
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
}

// Update view label
function updateViewLabel() {
    const type = getCurrentViewType();
    const labels = {
        'active': 'Active',
        'recurring': 'Concurrent',
        'done': 'Completed'
    };
    viewLabelElement.textContent = labels[type] || 'Active';
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

// Check and reset daily tasks at midnight
async function checkDailyTaskResets() {
    const currentDate = getDenverDateString();
    
    // Find all daily reset tasks in recurring list
    const dailyTasksToReset = tasks.recurring.filter(task => 
        task.daily_reset && 
        task.last_completed_date && 
        task.last_completed_date !== currentDate
    );
    
    // Reset them back to active
    for (const task of dailyTasksToReset) {
        await updateTask(task.id, {
            list_type: 'active',
            last_completed_date: null
        });
    }
    
    // Delete completed non-recurring tasks older than 24 hours
    const now = getDenverTime();
    const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const tasksToDelete = tasks.done.filter(task => {
        if (task.type === 'recurring' || task.daily_reset) return false;
        
        // Check if task has been in done list for 24+ hours
        if (task.completed_at) {
            const completedTime = new Date(task.completed_at);
            return completedTime < oneDayAgo;
        }
        return false;
    });
    
    for (const task of tasksToDelete) {
        await deleteTask(task.id);
    }
    
    if (dailyTasksToReset.length > 0 || tasksToDelete.length > 0) {
        await renderAllViews();
    }
}

// Calculate completion percentage for daily reset tasks
function calculateCompletionPercentage(task) {
    if (!task.daily_reset || !task.created_at) {
        return null;
    }
    
    const createdDate = new Date(task.created_at);
    const currentDate = getDenverTime();
    
    // Calculate days since creation
    const daysSinceCreation = Math.floor((currentDate - createdDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Count completion days based on days_enabled
    let eligibleDays = 0;
    if (task.days_enabled) {
        eligibleDays = daysSinceCreation;
    } else {
        // Count only the specified days of week since creation
        const createdDayOfWeek = createdDate.getDay();
        const daysMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        const enabledDayNumbers = task.days.map(d => daysMap[d]);
        
        for (let i = 0; i < daysSinceCreation; i++) {
            const checkDate = new Date(createdDate);
            checkDate.setDate(checkDate.getDate() + i);
            if (enabledDayNumbers.includes(checkDate.getDay())) {
                eligibleDays++;
            }
        }
    }
    
    const completionCount = task.completion_count || 0;
    const percentage = eligibleDays > 0 ? Math.round((completionCount / eligibleDays) * 100) : 0;
    
    return { completionCount, eligibleDays, percentage };
}

// Shuffle array utility
function shuffleArray(array) {
    if (array.length === 0) return [];
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Render view
function renderView(viewIndex) {
    const view = views[viewIndex];
    const type = view.dataset.type;
    const container = document.getElementById(`tasks-${viewIndex}`);
    container.innerHTML = '';
    
    if (type === 'active') {
        const visibleActive = tasks.active.filter(isTaskVisibleNow);
        const shuffled = shuffleArray(visibleActive);
        shuffled.forEach((task, index) => {
            const taskEl = createTaskElement(task, 'active', index);
            container.appendChild(taskEl);
        });
    } else if (type === 'recurring') {
        const visibleRecurring = tasks.recurring.filter(isTaskVisibleNow);
        const shuffled = shuffleArray(visibleRecurring);
        shuffled.forEach((task, index) => {
            const taskEl = createTaskElement(task, 'recurring', index, shuffled.length);
            container.appendChild(taskEl);
        });
    } else if (type === 'done') {
        const visibleDone = tasks.done.filter(isTaskVisibleNow);
        const shuffled = shuffleArray(visibleDone);
        shuffled.forEach((task, index) => {
            const taskEl = createTaskElement(task, 'done', index);
            container.appendChild(taskEl);
        });
    }
}

// Render all views
async function renderAllViews() {
    await loadTasks();
    await checkDailyTaskResets();
    views.forEach((_, index) => renderView(index));
}
function createTaskElement(task, listType, index, totalRecurring = 0) {
    const div = document.createElement('div');
    div.className = `task ${task.category}`;
    div.textContent = task.name;
    
    // Grey out completed tasks
    if (listType === 'done') {
        div.style.color = '#666666';
    }
    
    if (listType === 'recurring' && totalRecurring > 0) {
        const opacity = 1 - (index / totalRecurring) * 0.6;
        div.style.opacity = opacity;
    }
    
    if (listType === 'active') {
        let tapCount = 0;
        let tapTimer = null;
        
        div.addEventListener('click', async () => {
            tapCount++;
            
            if (tapCount === 1) {
                // First tap - visual feedback
                div.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                
                // Reset after 500ms
                tapTimer = setTimeout(() => {
                    tapCount = 0;
                    div.style.backgroundColor = '';
                }, 500);
            } else if (tapCount === 2) {
                // Second tap - complete the task
                clearTimeout(tapTimer);
                tapCount = 0;
                div.style.backgroundColor = '';
                
                if (task.daily_reset) {
                    // Daily reset tasks move to recurring (concurrent) and track completion
                    const currentDate = getDenverDateString();
                    const newCompletionCount = (task.completion_count || 0) + 1;
                    
                    await updateTask(task.id, {
                        list_type: 'recurring',
                        last_completed_date: currentDate,
                        completion_count: newCompletionCount
                    });
                } else {
                    // Regular tasks move to done and track completion time
                    await updateTask(task.id, { 
                        list_type: 'done',
                        completed_at: new Date().toISOString()
                    });
                }
                await renderAllViews();
            }
        });
    }
    
    return div;
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
    if (isAnimating) {
        queuedSwipe = true;
        return;
    }
    
    isAnimating = true;
    const wasQueued = queuedSwipe;
    queuedSwipe = false;
    
    currentViewIndex++;
    updatePositions();
    updateBackgroundColor();
    updateViewLabel();
    
    setTimeout(() => {
        let hasRepositioned = false;
        views.forEach((view, index) => {
            const position = viewPositions[index];
            
            if (position < currentViewIndex - 2) {
                hasRepositioned = true;
                view.style.transition = 'none';
                view.style.opacity = '0';
                
                viewPositions[index] = currentViewIndex + 3;
                view.offsetHeight;
                
                const offset = (viewPositions[index] - currentViewIndex) * 100;
                view.style.transform = `translateY(${offset}vh)`;
                
                setTimeout(() => {
                    view.style.transition = 'transform 350ms ease-in-out';
                    view.style.opacity = '1';
                }, 50);
            }
        });
        
        // Unlock and check for queued swipe in a single final timeout
        const unlockDelay = hasRepositioned ? 50 : 0;
        setTimeout(() => {
            isAnimating = false;
            if (queuedSwipe) {
                // Use setTimeout to ensure unlock completes first
                setTimeout(() => cycleView(), 0);
            }
        }, unlockDelay);
    }, 350);
}

// Editor UI handlers
editBtn.addEventListener('click', () => {
    addTaskOverlay.classList.remove('hidden');
    taskNameInput.value = '';
    urgentCheckbox.checked = false;
    colorSelectContainer.style.display = 'block';
    temporaryCheckbox.checked = false;
    recurringCheckbox.checked = false;
    allDaysCheckbox.checked = true;
    daysSelectContainer.style.display = 'none';
    allTimeCheckbox.checked = true;
    timeSelectContainer.style.display = 'none';
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
    
    const isTemporary = temporaryCheckbox.checked;
    const isRecurring = recurringCheckbox.checked;
    const isDailyReset = isTemporary && isRecurring;
    
    // Determine type and list_type
    let type, list_type;
    if (isDailyReset) {
        // Both checked: daily reset task starts on active
        type = 'recurring';
        list_type = 'active';
    } else if (isRecurring) {
        // Only recurring: goes to recurring list
        type = 'recurring';
        list_type = 'recurring';
    } else {
        // Only temporary or neither: goes to active as one-off
        type = 'oneoff';
        list_type = 'active';
    }
    
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
        list_type: list_type,
        daily_reset: isDailyReset,
        completion_count: 0,
        last_completed_date: null,
        days_enabled: days_enabled,
        days: days,
        time_enabled: time_enabled,
        start_time: start_time,
        end_time: end_time,
        created_at: new Date().toISOString()
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

editUrgentCheckbox.addEventListener('change', () => {
    editColorSelectContainer.style.display = editUrgentCheckbox.checked ? 'none' : 'block';
});

editAllDaysCheckbox.addEventListener('change', () => {
    editDaysSelectContainer.style.display = editAllDaysCheckbox.checked ? 'none' : 'block';
});

editAllTimeCheckbox.addEventListener('change', () => {
    editTimeSelectContainer.style.display = editAllTimeCheckbox.checked ? 'none' : 'block';
});

saveEditBtn.addEventListener('click', async () => {
    if (!currentEditingTaskId) return;
    
    const name = editTaskNameInput.value.trim();
    if (!name) return;
    
    const isUrgent = editUrgentCheckbox.checked;
    const category = isUrgent ? 'urgent' : editColorSelect.value;
    
    const isTemporary = editTemporaryCheckbox.checked;
    const isRecurring = editRecurringCheckbox.checked;
    const isDailyReset = isTemporary && isRecurring;
    
    // Determine type and list_type
    let type, list_type;
    if (isDailyReset) {
        type = 'recurring';
        list_type = 'active';
    } else if (isRecurring) {
        type = 'recurring';
        list_type = 'recurring';
    } else {
        type = 'oneoff';
        list_type = 'active';
    }
    
    const days_enabled = editAllDaysCheckbox.checked;
    const days = days_enabled ? ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] : 
        Array.from(document.querySelectorAll('input[name="edit-day"]:checked')).map(el => el.value);
    
    const time_enabled = editAllTimeCheckbox.checked;
    const start_time = time_enabled ? null : editStartTimeInput.value;
    const end_time = time_enabled ? null : editEndTimeInput.value;
    
    await updateTask(currentEditingTaskId, {
        name: name,
        category: category,
        type: type,
        list_type: list_type,
        daily_reset: isDailyReset,
        days_enabled: days_enabled,
        days: days,
        time_enabled: time_enabled,
        start_time: start_time,
        end_time: end_time
    });
    
    currentEditingTaskId = null;
    editTaskOverlay.classList.add('hidden');
    await renderAllViews();
    await renderManageTasksList();
});

cancelEditBtn.addEventListener('click', () => {
    currentEditingTaskId = null;
    editTaskOverlay.classList.add('hidden');
});

// Close all overlays when clicking outside the content
[addTaskOverlay, manageTasksOverlay, editTaskOverlay].forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            // Close all overlays at once
            addTaskOverlay.classList.add('hidden');
            manageTasksOverlay.classList.add('hidden');
            editTaskOverlay.classList.add('hidden');
            currentEditingTaskId = null;
        }
    });
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
    
    // Group tasks by category
    const categories = {
        urgent: { name: 'Urgent', tasks: [] },
        fitness: { name: 'Fitness', tasks: [] },
        academic: { name: 'Academic', tasks: [] },
        social: { name: 'Social', tasks: [] },
        misc: { name: 'Misc', tasks: [] }
    };
    
    allTasks.forEach(task => {
        if (categories[task.category]) {
            categories[task.category].tasks.push(task);
        }
    });
    
    // Create collapsible sections for each category
    Object.entries(categories).forEach(([categoryKey, categoryData]) => {
        if (categoryData.tasks.length === 0) return;
        
        const section = document.createElement('div');
        section.className = 'category-section';
        
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
            <span class="${categoryKey}">${categoryData.name} (${categoryData.tasks.length})</span>
            <span class="collapse-icon">▼</span>
        `;
        
        const content = document.createElement('div');
        content.className = 'category-content';
        content.style.display = 'none';
        
        categoryData.tasks.forEach((task) => {
            const item = document.createElement('div');
            item.className = 'manage-task-item';
            
            const daysText = task.days_enabled ? 'All days' : task.days.join(', ');
            const timeText = task.time_enabled ? 'All times' : `${task.start_time} - ${task.end_time}`;
            
            let completionText = '';
            if (task.daily_reset) {
                const stats = calculateCompletionPercentage(task);
                if (stats) {
                    completionText = `<p>Completion: ${stats.completionCount}/${stats.eligibleDays} days (${stats.percentage}%)</p>`;
                }
            }
            
            const restoreButton = task.listType === 'done' 
                ? `<button class="secondary-btn restore-task-btn" data-id="${task.id}" data-type="${task.type}" data-daily-reset="${task.daily_reset}">Move Back</button>` 
                : '';
            
            item.innerHTML = `
                <h3 class="${task.category}">${task.name}</h3>
                <p>Type: ${task.type}</p>
                <p>List: ${task.listType}</p>
                ${task.daily_reset ? '<p>Daily Reset: Yes</p>' : ''}
                ${completionText}
                <p>Days: ${daysText}</p>
                <p>Time: ${timeText}</p>
                <button class="secondary-btn edit-task-btn" data-id="${task.id}">Edit</button>
                ${restoreButton}
                <button class="secondary-btn delete-task-btn" data-id="${task.id}">Delete</button>
            `;
            content.appendChild(item);
        });
        
        // Toggle collapse on header click
        header.addEventListener('click', () => {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            header.querySelector('.collapse-icon').textContent = isHidden ? '▲' : '▼';
        });
        
        section.appendChild(header);
        section.appendChild(content);
        container.appendChild(section);
    });
    
    // Add edit handlers
    document.querySelectorAll('.edit-task-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const taskId = e.target.dataset.id;
            const task = allTasks.find(t => t.id === taskId);
            if (!task) return;
            
            // Populate edit form
            currentEditingTaskId = taskId;
            editTaskNameInput.value = task.name;
            editUrgentCheckbox.checked = task.category === 'urgent';
            editColorSelectContainer.style.display = task.category === 'urgent' ? 'none' : 'block';
            editColorSelect.value = task.category === 'urgent' ? 'fitness' : task.category;
            
            // Set type checkboxes based on task
            if (task.daily_reset) {
                editTemporaryCheckbox.checked = true;
                editRecurringCheckbox.checked = true;
            } else if (task.type === 'recurring') {
                editTemporaryCheckbox.checked = false;
                editRecurringCheckbox.checked = true;
            } else {
                editTemporaryCheckbox.checked = true;
                editRecurringCheckbox.checked = false;
            }
            
            editAllDaysCheckbox.checked = task.days_enabled;
            editDaysSelectContainer.style.display = task.days_enabled ? 'none' : 'block';
            
            // Set day checkboxes
            document.querySelectorAll('input[name="edit-day"]').forEach(checkbox => {
                checkbox.checked = task.days.includes(checkbox.value);
            });
            
            editAllTimeCheckbox.checked = task.time_enabled;
            editTimeSelectContainer.style.display = task.time_enabled ? 'none' : 'block';
            editStartTimeInput.value = task.start_time || '';
            editEndTimeInput.value = task.end_time || '';
            
            // Show edit overlay
            editTaskOverlay.classList.remove('hidden');
        });
    });
    
    // Add restore handlers for done tasks
    document.querySelectorAll('.restore-task-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const taskId = e.target.dataset.id;
            const taskType = e.target.dataset.type;
            const isDailyReset = e.target.dataset.dailyReset === 'true';
            
            // Determine where to move it back to
            let newListType;
            if (isDailyReset) {
                // Daily reset tasks go back to active
                newListType = 'active';
            } else if (taskType === 'recurring') {
                // Regular recurring tasks go back to recurring
                newListType = 'recurring';
            } else {
                // One-off tasks go back to active
                newListType = 'active';
            }
            
            await updateTask(taskId, { 
                list_type: newListType,
                completed_at: null  // Clear completion timestamp
            });
            await renderAllViews();
            await renderManageTasksList();
        });
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
    if (e.code === 'Space' && 
        addTaskOverlay.classList.contains('hidden') && 
        manageTasksOverlay.classList.contains('hidden') &&
        editTaskOverlay.classList.contains('hidden')) {
        e.preventDefault();
        cycleView();
    }
});

// Check for midnight resets every minute
setInterval(async () => {
    await renderAllViews();
}, 60000);

// Update clock every second
setInterval(updateClock, 1000);

// Initialize
(async () => {
    await renderAllViews();
    updatePositions();
    updateBackgroundColor();
    updateViewLabel();
    updateClock();
})();

// LATEST VERSION - Updated with edit task functionality - 2026-01-15
