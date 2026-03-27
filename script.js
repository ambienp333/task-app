const viewHistoryBtn = document.getElementById('view-history-btn');
const taskHistoryOverlay = document.getElementById('task-history-overlay');
const closeHistoryBtn = document.getElementById('close-history-btn');
const viewDailyArchiveBtn = document.getElementById('view-daily-archive-btn');
const dailyArchiveOverlay = document.getElementById('daily-archive-overlay');
const closeDailyArchiveBtn = document.getElementById('close-daily-archive-btn');
const archiveDateInput = document.getElementById('archive-date-input');
const clockElement = document.getElementById('clock');
const viewLabelElement = document.getElementById('view-label');

@@ -122,6 +126,14 @@ function getDenverTimeString() {
}

function isTaskVisibleNow(task) {
    // Check if daily reset task was already completed today
    if (task.daily_reset && task.last_completed_date) {
        const currentDate = getDenverDateString();
        if (task.last_completed_date === currentDate) {
            return false; // Hide until 4am tomorrow
        }
    }
    
// Check days
if (!task.days_enabled) {
const currentDay = getDenverDayOfWeek();
@@ -369,11 +381,7 @@ function createTaskElement(task, listType, index, totalInList = 0) {
div.style.color = '#666666';
}

    // Apply opacity fade for daily tasks (like old recurring)
    if (listType === 'daily' && totalInList > 0) {
        const opacity = 1 - (index / totalInList) * 0.6;
        div.style.opacity = opacity;
    }
    // No opacity fade for daily tasks anymore

// Make active and daily tasks clickable
if (listType === 'active' || listType === 'daily') {
@@ -643,6 +651,70 @@ closeHistoryBtn.addEventListener('click', () => {
taskHistoryOverlay.classList.add('hidden');
});

viewDailyArchiveBtn.addEventListener('click', () => {
    // Set default date to today
    const today = getDenverDateString();
    archiveDateInput.value = today;
    renderDailyArchive(today);
    dailyArchiveOverlay.classList.remove('hidden');
});

closeDailyArchiveBtn.addEventListener('click', () => {
    dailyArchiveOverlay.classList.add('hidden');
});

archiveDateInput.addEventListener('change', (e) => {
    renderDailyArchive(e.target.value);
});

// Render daily archive for a specific date
async function renderDailyArchive(dateString) {
    const container = document.getElementById('daily-archive-list');
    container.innerHTML = '<p>Loading...</p>';
    
    // Fetch all tasks created on this date
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', dateString + 'T00:00:00')
        .lt('created_at', dateString + 'T23:59:59')
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('Error loading daily archive:', error);
        container.innerHTML = '<p>Error loading archive.</p>';
        return;
    }
    
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p>No tasks created on this date.</p>';
        return;
    }
    
    // Display tasks
    data.forEach(task => {
        const item = document.createElement('div');
        item.className = 'manage-task-item';
        
        const createdTime = new Date(task.created_at).toLocaleTimeString('en-US', {
            timeZone: 'America/Denver',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        item.innerHTML = `
            <h3 class="${task.category}">${task.name}</h3>
            <p>Created at: ${createdTime}</p>
            <p>Type: ${task.type}</p>
            <p>Current Status: ${task.list_type}</p>
        `;
        container.appendChild(item);
    });
}

// Render task history (all tasks ever created)
async function renderTaskHistory() {
const container = document.getElementById('task-history-list');
@@ -832,14 +904,15 @@ cancelEditBtn.addEventListener('click', () => {
});

// Close all overlays when clicking outside the content
[addTaskOverlay, manageTasksOverlay, editTaskOverlay, taskHistoryOverlay].forEach(overlay => {
[addTaskOverlay, manageTasksOverlay, editTaskOverlay, taskHistoryOverlay, dailyArchiveOverlay].forEach(overlay => {
overlay.addEventListener('click', (e) => {
if (e.target === overlay) {
// Close all overlays at once
addTaskOverlay.classList.add('hidden');
manageTasksOverlay.classList.add('hidden');
editTaskOverlay.classList.add('hidden');
taskHistoryOverlay.classList.add('hidden');
            dailyArchiveOverlay.classList.add('hidden');
currentEditingTaskId = null;
}
});
@@ -1097,7 +1170,8 @@ document.addEventListener('keydown', (e) => {
addTaskOverlay.classList.contains('hidden') && 
manageTasksOverlay.classList.contains('hidden') &&
editTaskOverlay.classList.contains('hidden') &&
        taskHistoryOverlay.classList.contains('hidden')) {
        taskHistoryOverlay.classList.contains('hidden') &&
        dailyArchiveOverlay.classList.contains('hidden')) {
e.preventDefault();
cycleView();
}
