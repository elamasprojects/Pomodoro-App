// script.js

// ===== CONFIG & MODES =====
const defaultConfig = { pomodoro: 25, shortBreak: 5, longBreak: 15 };
const config = JSON.parse(localStorage.getItem('pomodoroConfig')) || defaultConfig;
const modes = {
  pomodoro: config.pomodoro * 60,
  'short-break': config.shortBreak * 60,
  'long-break': config.longBreak * 60
};
let currentMode = 'pomodoro';
let timeLeft = modes[currentMode];
let isRunning = false;
let timer;
let completedPomodoros = parseInt(localStorage.getItem('completedPomodoros')) || 0;
let activeProjectId = localStorage.getItem('activeProjectId') || null;
let sessionStartTime = null;

// Create audio element for applause
const applauseSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');

// ===== DOM ELEMENTS =====
const timerDisplay = document.getElementById('timer');
const modeButtons = document.querySelectorAll('.mode-button');
const startButton = document.getElementById('start');
const resetButton = document.getElementById('reset');
const fullscreenButton = document.getElementById('fullscreen');
const projectsContainer = document.getElementById('projects-container');
const timerContainer = document.getElementById('timer-container');
const controlsContainer = document.getElementById('controls-container');

let isFocusMode = false;

// Add edit button next to timer
const editButton = document.createElement('button');
editButton.className = 'edit-timer-btn';
editButton.innerHTML = '✏️';
editButton.title = 'Edit Timer';
editButton.onclick = enableTimerEdit;
timerDisplay.parentNode.insertBefore(editButton, timerDisplay.nextSibling);

// ===== INITIAL SETUP =====
applyBackground();
updateDisplay();
renderProjects();
updatePomodoroCircles(); // Initialize circles on load

// ===== TIMER FUNCTIONS =====
function formatTime(s) {
  const m = Math.floor(s/60), sec = s%60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function updateDisplay() {
  timerDisplay.textContent = formatTime(timeLeft);
  // toggle start/pause label
  startButton.textContent = isRunning ? 'Pause' : 'Start';
}
function applyBackground() {
  if (currentMode === 'pomodoro') document.body.style.background = '#000';
  else if (currentMode === 'short-break') document.body.style.background = '#4a90e2';
  else document.body.style.background = '#0050a1';
  modeButtons.forEach(b => b.classList.toggle('active', b.dataset.mode === currentMode));
}
function switchMode(mode) {
  clearInterval(timer);
  isRunning = false;
  currentMode = mode;
  timeLeft = modes[mode];
  applyBackground(); 
  updateDisplay();
  
  // Update segmented control
  if (window.segmented) {
    let segmentIndex;
    if (mode === 'pomodoro') segmentIndex = 0;
    else if (mode === 'short-break') segmentIndex = 1;
    else if (mode === 'long-break') segmentIndex = 2;
    
    window.segmented.setActive(segmentIndex);
  }
}
function tick() {
  if (timeLeft>0) {
    timeLeft--; updateDisplay();
    logFocusSecond();
  } else finishCycle();
}
function updatePomodoroCircles(lastFilledIndex = null) {
  const circles = document.querySelectorAll('.pomodoro-circle');
  circles.forEach((circle, index) => {
    if (index < completedPomodoros) {
      if (!circle.classList.contains('filled')) {
        circle.classList.add('filled');
        // If this is the last filled circle, trigger sparkles
        if (lastFilledIndex !== null && index === lastFilledIndex) {
          triggerSparkles(circle);
        }
      }
    } else {
      circle.classList.remove('filled');
    }
  });
}
function triggerSparkles(circle) {
  // Create several sparkles
  for (let i = 0; i < 12; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    // Random direction and distance
    const angle = (Math.PI * 2 * i) / 12;
    const distance = 24 + Math.random() * 10;
    sparkle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    sparkle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    circle.appendChild(sparkle);
    // Remove sparkle after animation
    setTimeout(() => {
      sparkle.remove();
    }, 700);
  }
}
function resetPomodoroCircles() {
  completedPomodoros = 0;
  localStorage.setItem('completedPomodoros', completedPomodoros);
  updatePomodoroCircles();
}
function finishCycle() {
  clearInterval(timer); 
  isRunning = false;
  
  if (currentMode === 'pomodoro') {
    saveSession('completed');
  }
  
  // Play applause sound
  applauseSound.play().catch(error => {
    console.log('Audio playback failed:', error);
  });
  
  // Update pomodoro circles if a focus session was completed
  if (currentMode === 'pomodoro') {
    const prevCompleted = completedPomodoros;
    completedPomodoros = (completedPomodoros + 1) % 5;
    localStorage.setItem('completedPomodoros', completedPomodoros);
    // Pass the just-filled circle index for animation
    updatePomodoroCircles(prevCompleted);
  } else {
    updatePomodoroCircles();
  }
  
  // auto switch
  if (currentMode === 'pomodoro') switchMode('short-break');
  else switchMode('pomodoro');
}

function enableTimerEdit() {
  if (isRunning) {
    alert('Please pause the timer before editing');
    return;
  }
  
  const currentTime = formatTime(timeLeft);
  timerDisplay.contentEditable = true;
  timerDisplay.focus();
  timerDisplay.textContent = currentTime;
  
  // Select the minutes part
  const range = document.createRange();
  range.selectNodeContents(timerDisplay);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Handle input validation and submission
  timerDisplay.onkeydown = function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTime = timerDisplay.textContent.trim();
      if (validateAndSetTime(newTime)) {
        timerDisplay.contentEditable = false;
        timerDisplay.onkeydown = null;
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      timerDisplay.textContent = formatTime(timeLeft);
      timerDisplay.contentEditable = false;
      timerDisplay.onkeydown = null;
    }
  };
  
  timerDisplay.onblur = function() {
    timerDisplay.textContent = formatTime(timeLeft);
    timerDisplay.contentEditable = false;
    timerDisplay.onkeydown = null;
  };
}

function validateAndSetTime(timeStr) {
  // Allow both MM:SS and M:SS formats
  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const match = timeStr.match(timeRegex);
  
  if (!match) {
    alert('Please enter time in MM:SS format');
    return false;
  }
  
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  
  if (minutes > 99 || seconds > 59) {
    alert('Invalid time values');
    return false;
  }
  
  timeLeft = minutes * 60 + seconds;
  updateDisplay();
  return true;
}

// ===== CONTROLS =====
startButton.addEventListener('click', () => {
  if (!isRunning) {
    if (!activeProjectId && currentMode === 'pomodoro') {
      alert('Please select an active project before starting the timer');
      return;
    }
    sessionStartTime = new Date().toISOString();
    timer = setInterval(tick, 1000);
    isRunning = true;
  } else {
    clearInterval(timer);
    isRunning = false;
    if (currentMode === 'pomodoro') {
      saveSession('interrupted');
    }
  }
  updateDisplay();
});
resetButton.addEventListener('click', () => {
  clearInterval(timer);
  isRunning = false;
  if (currentMode === 'pomodoro' && sessionStartTime) {
    saveSession('interrupted');
  }
  timeLeft = modes[currentMode];
  updateDisplay();
  resetPomodoroCircles();
});
fullscreenButton.addEventListener('click', ()=>{
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
  toggleFocusMode();
});
modeButtons.forEach(btn=> btn.addEventListener('click',()=> switchMode(btn.dataset.mode)));

function toggleFocusMode() {
  isFocusMode = !isFocusMode;
  document.body.classList.toggle('focus-mode', isFocusMode);
  // Hide segmented control in focus mode
  const segContainer = document.getElementById('segmented-control-container');
  if (segContainer) {
    segContainer.style.display = isFocusMode ? 'none' : '';
  }
  // Update fullscreen button icon
  fullscreenButton.innerHTML = isFocusMode ? '⤢' : '⤡';
  fullscreenButton.title = isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode';
  // Update button text
  startButton.textContent = isRunning ? 'Pause' : 'Start';
}

// ===== SESSION STORAGE =====
function guardarSesion() {
  const sesiones = JSON.parse(localStorage.getItem('pomodoroSessions'))||[];
  sesiones.push({ mode: currentMode, duration: config[currentMode], timestamp:new Date().toISOString() });
  localStorage.setItem('pomodoroSessions', JSON.stringify(sesiones));
}

function saveSession(status) {
  if (!activeProjectId) return;
  
  const session = {
    projectId: activeProjectId,
    mode: currentMode,
    duration: config[currentMode],
    startTime: sessionStartTime,
    endTime: new Date().toISOString(),
    status: status
  };
  
  const sessions = JSON.parse(localStorage.getItem('pomodoroSessions')) || [];
  sessions.push(session);
  localStorage.setItem('pomodoroSessions', JSON.stringify(sessions));
}

// ===== PROJECTS / CHECKPOINTS / TASKS =====
function loadData(){
  return JSON.parse(localStorage.getItem('pomodoroData'))||[];
}
function saveData(data){
  localStorage.setItem('pomodoroData', JSON.stringify(data));
}
function renderProjects(){
  const data = loadData();
  projectsContainer.innerHTML = '';
  // Separate active and completed projects
  const activeProjects = data.filter(proj => !proj.completed);
  const completedProjects = data.filter(proj => proj.completed);

  // Render active projects
  activeProjects.forEach(proj => {
    const div = document.createElement('div'); 
    div.className = `project ${proj.id === activeProjectId ? 'active' : ''}`;
    div.setAttribute('data-project-id', proj.id);
    // header
    const hdr = document.createElement('div'); 
    hdr.className = 'project-header';
    const titleContainer = document.createElement('div');
    titleContainer.className = 'project-title-container';

    // Set Active button (moved above title)
    const setActiveBtn = document.createElement('button');
    setActiveBtn.className = 'set-active-btn';
    setActiveBtn.textContent = proj.id === activeProjectId ? 'Active' : 'Set Active';
    setActiveBtn.onclick = () => setActiveProject(proj.id);
    if (proj.id === activeProjectId) setActiveBtn.style.display = 'none';
    titleContainer.appendChild(setActiveBtn);

    // Project title
    const title = document.createElement('span'); 
    title.textContent = `${proj.emoji} ${proj.title}`;
    if (proj.id === activeProjectId) {
      const activeBadge = document.createElement('span');
      activeBadge.className = 'active-badge';
      activeBadge.textContent = 'Active';
      title.appendChild(activeBadge);
    }
    titleContainer.appendChild(title);

    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    const progressText = document.createElement('span');
    progressText.className = 'progress-text';
    progressContainer.append(progressBar, progressText);
    titleContainer.appendChild(progressContainer);

    const headerControls = document.createElement('div');
    headerControls.className = 'header-controls';
    
    const btnAddCP = document.createElement('button'); 
    btnAddCP.textContent = '+ Add Checkpoint'; 
    btnAddCP.className = 'btn-add';
    btnAddCP.onclick = () => showCheckpointForm(proj.id);
    
    // Check (complete) button
    const btnComplete = document.createElement('button');
    btnComplete.className = 'complete-btn';
    btnComplete.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10" stroke="#4a90e2" stroke-width="2" fill="none"/><path d="M7 11.5L10 14.5L15 9.5" stroke="#4a90e2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    
    // Check if all tasks are completed
    const allTasksCompleted = proj.checkpoints.every(cp => 
      cp.tasks.length > 0 && cp.tasks.every(task => task.completed)
    );
    
    if (!allTasksCompleted) {
      btnComplete.style.opacity = '0.3';
      btnComplete.style.cursor = 'not-allowed';
      btnComplete.title = 'Complete all tasks first';
    } else {
      btnComplete.style.opacity = '1';
      btnComplete.style.cursor = 'pointer';
      btnComplete.title = 'Mark as Completed';
      btnComplete.onclick = () => completeProject(proj.id);
    }
    
    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'delete-btn';
    btnDelete.innerHTML = '🗑️';
    btnDelete.title = 'Delete Project';
    btnDelete.onclick = () => deleteProject(proj.id);
    headerControls.append(btnAddCP, btnComplete, btnDelete);
    hdr.append(titleContainer, headerControls);
    div.append(hdr);
    // checkpoints
    proj.checkpoints.forEach(cp=>{
      const cpDiv = document.createElement('div'); 
      cpDiv.className='checkpoint';
      cpDiv.setAttribute('data-checkpoint-id', cp.id);
      const cpHdr = document.createElement('div'); cpHdr.className='checkpoint-header';
      const cpTitle = document.createElement('span'); cpTitle.textContent=`${cp.emoji} ${cp.title}`;
      cpTitle.style.color = cp.color;
      const btnAddTask = document.createElement('button'); 
      btnAddTask.textContent='+ Add Task'; 
      btnAddTask.className = 'btn-add';
      btnAddTask.onclick=()=> showTaskForm(proj.id, cp.id);
      cpHdr.append(cpTitle, btnAddTask); cpDiv.append(cpHdr);
      const ul = document.createElement('ul'); ul.className='tasks-list';
      cp.tasks.forEach(task=>{
        const li = document.createElement('li'); li.className='task-item';
        const chk = document.createElement('input'); chk.type='checkbox'; chk.checked=task.completed;
        chk.onchange=()=> toggleTask(proj.id, cp.id, task.id, chk.checked);
        const span = document.createElement('span'); span.textContent=task.text;
        // Make task editable on double-click
        span.ondblclick = function() {
          enableTaskEdit(span, proj.id, cp.id, task.id, task.text);
        };
        li.append(span, chk); ul.append(li);
      });
      cpDiv.append(ul);
      div.append(cpDiv);
    });
    projectsContainer.append(div);
    // Update progress bar after rendering
    updateProjectProgress(proj.id);
  });

  // Completed Projects Section
  if (completedProjects.length > 0) {
    const completedSection = document.createElement('section');
    completedSection.id = 'completed-projects-section';
    completedSection.style.marginTop = '40px';
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Completed Projects (' + completedProjects.length + ')';
    toggleBtn.className = 'toggle-completed-btn';
    toggleBtn.style.marginBottom = '10px';
    toggleBtn.onclick = function() {
      completedList.style.display = completedList.style.display === 'none' ? 'block' : 'none';
    };
    completedSection.appendChild(toggleBtn);
    const completedList = document.createElement('div');
    completedList.className = 'completed-projects-list';
    completedList.style.display = 'none';
    completedProjects.forEach(proj => {
      const div = document.createElement('div');
      div.className = 'project completed';
      div.setAttribute('data-project-id', proj.id);
      // header
      const hdr = document.createElement('div');
      hdr.className = 'project-header';
      const titleContainer = document.createElement('div');
      titleContainer.className = 'project-title-container';
      const title = document.createElement('span');
      title.textContent = `${proj.emoji} ${proj.title}`;
      titleContainer.append(title);
      hdr.append(titleContainer);
      div.append(hdr);
      completedList.append(div);
    });
    completedSection.appendChild(completedList);
    projectsContainer.appendChild(completedSection);
  }

  // Move Add Project block to the very bottom
  const addProjectBtn = document.createElement('button');
  addProjectBtn.className = 'add-project-btn';
  addProjectBtn.innerHTML = '+ Add Project';

  // Add project form with emoji picker (hidden by default, shown when Add Project is clicked)
  const addProjectForm = document.createElement('div');
  addProjectForm.className = 'add-project-form';
  addProjectForm.style.display = 'none';
  addProjectForm.innerHTML = `
    <button type="button" id="emoji-picker-btn" style="font-size:1.5rem;">😀</button>
    <input type="hidden" id="new-project-emoji">
    <input type="text" placeholder="Project title" id="new-project-title">
    <button id="add-project-submit-btn">Add Project</button>
    <emoji-picker style="display:none; position:absolute; z-index:1000;" id="emoji-picker"></emoji-picker>
  `;

  addProjectBtn.onclick = () => {
    addProjectForm.style.display = addProjectForm.style.display === 'none' ? 'flex' : 'none';
    if (addProjectForm.style.display === 'flex') {
      addProjectForm.querySelector('#new-project-title').focus();
    }
  };

  projectsContainer.appendChild(addProjectBtn);
  projectsContainer.appendChild(addProjectForm);

  // Emoji picker logic for project
  const emojiBtn = addProjectForm.querySelector('#emoji-picker-btn');
  const emojiInput = addProjectForm.querySelector('#new-project-emoji');
  const picker = addProjectForm.querySelector('#emoji-picker');
  emojiBtn.onclick = (e) => {
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    picker.style.position = 'absolute';
    picker.style.left = `${emojiBtn.offsetLeft}px`;
    picker.style.top = `${emojiBtn.offsetTop + emojiBtn.offsetHeight + 5}px`;
  };
  picker.addEventListener('emoji-click', event => {
    emojiInput.value = event.detail.unicode;
    emojiBtn.textContent = event.detail.unicode;
    picker.style.display = 'none';
  });

  // Add project submit button logic
  addProjectForm.querySelector('#add-project-submit-btn').onclick = function(e) {
    e.preventDefault();
    addProject();
    addProjectForm.style.display = 'none';
  };
  // Submit on Enter for project
  addProjectForm.querySelector('#new-project-title').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addProjectForm.querySelector('#add-project-submit-btn').click();
    }
  });
}

function updateProjectProgress(projectId) {
  const data = loadData();
  const project = data.find(p => p.id === projectId);
  if (!project) return;

  const totalTasks = project.checkpoints.reduce((sum, cp) => sum + cp.tasks.length, 0);
  const completedTasks = project.checkpoints.reduce((sum, cp) => 
    sum + cp.tasks.filter(task => task.completed).length, 0);
  
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  const projectElement = document.querySelector(`[data-project-id="${projectId}"]`);
  if (projectElement) {
    const progressBar = projectElement.querySelector('.progress-bar');
    const progressText = projectElement.querySelector('.progress-text');
    
    if (progressBar && progressText) {
      progressBar.style.setProperty('--progress-width', `${progress}%`);
      progressText.textContent = `${completedTasks}/${totalTasks}`;
    }
  }
}

function showCheckpointForm(projId) {
  const form = document.createElement('div');
  form.className = 'checkpoint-form';
  form.innerHTML = `
    <button type="button" id="emoji-picker-btn-cp" style="font-size:1.5rem;">😀</button>
    <input type="hidden" id="new-checkpoint-emoji">
    <input type="text" placeholder="Checkpoint title" id="new-checkpoint-title">
    <input type="color" id="new-checkpoint-color" value="#ff0055">
    <button id="add-checkpoint-submit-btn">Add Checkpoint</button>
    <emoji-picker style="display:none; position:absolute; z-index:1000;" id="emoji-picker-cp"></emoji-picker>
  `;
  document.querySelector(`[data-project-id="${projId}"]`).appendChild(form);

  // Emoji picker logic for checkpoint
  const emojiBtn = form.querySelector('#emoji-picker-btn-cp');
  const emojiInput = form.querySelector('#new-checkpoint-emoji');
  const picker = form.querySelector('#emoji-picker-cp');
  emojiBtn.onclick = (e) => {
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    picker.style.position = 'absolute';
    picker.style.left = `${emojiBtn.offsetLeft}px`;
    picker.style.top = `${emojiBtn.offsetTop + emojiBtn.offsetHeight + 5}px`;
  };
  picker.addEventListener('emoji-click', event => {
    emojiInput.value = event.detail.unicode;
    emojiBtn.textContent = event.detail.unicode;
    picker.style.display = 'none';
  });
  // Add checkpoint submit button logic
  form.querySelector('#add-checkpoint-submit-btn').onclick = function(e) {
    e.preventDefault();
    addCheckpoint(projId);
  };
  // Submit on Enter for checkpoint
  form.querySelector('#new-checkpoint-title').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      form.querySelector('#add-checkpoint-submit-btn').click();
    }
  });
}

function showTaskForm(projId, cpId) {
  const form = document.createElement('div');
  form.className = 'task-form';
  form.innerHTML = `
    <input type="text" placeholder="Task description" id="new-task-text">
    <button id="add-task-submit-btn">Add Task</button>
  `;
  document.querySelector(`[data-checkpoint-id="${cpId}"]`).appendChild(form);
  // Add task submit button logic
  form.querySelector('#add-task-submit-btn').onclick = function(e) {
    e.preventDefault();
    addTask(projId, cpId);
  };
  // Submit on Enter for task
  form.querySelector('#new-task-text').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      form.querySelector('#add-task-submit-btn').click();
    }
  });
}

function addProject(){
  const title = document.getElementById('new-project-title').value;
  const emoji = document.getElementById('new-project-emoji').value;
  if(!title) return;
  
  const data = loadData();
  data.push({ id:Date.now(), title, emoji, checkpoints:[] });
  saveData(data); 
  renderProjects();
}

function addCheckpoint(projId){
  const title = document.getElementById('new-checkpoint-title').value;
  const emoji = document.getElementById('new-checkpoint-emoji').value;
  const color = document.getElementById('new-checkpoint-color').value;
  if(!title) return;
  
  const data = loadData();
  const proj = data.find(p=>p.id===projId);
  proj.checkpoints.push({ id:Date.now(), title, emoji, color, tasks:[] });
  saveData(data); 
  renderProjects();
}

function addTask(projId, cpId){
  const text = document.getElementById('new-task-text').value;
  if(!text) return;
  
  const data = loadData();
  const cp = data.find(p=>p.id===projId).checkpoints.find(c=>c.id===cpId);
  cp.tasks.push({ id:Date.now(), text, completed:false });
  saveData(data); 
  renderProjects();
}

function toggleTask(projId, cpId, taskId, completed) {
  const data = loadData();
  const task = data.find(p => p.id === projId)
    .checkpoints.find(c => c.id === cpId)
    .tasks.find(t => t.id === taskId);
  
  task.completed = completed;
  saveData(data);
  updateProjectProgress(projId);
}

function deleteProject(projectId) {
  const data = loadData();
  const updatedData = data.filter(proj => proj.id !== projectId);
  saveData(updatedData);
  renderProjects();
}

function enableTaskEdit(span, projId, cpId, taskId, oldText) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldText;
  input.className = 'edit-task-input';
  input.style.width = '100%';
  span.replaceWith(input);
  input.focus();
  input.select();

  function saveEdit() {
    const newText = input.value.trim();
    if (newText && newText !== oldText) {
      const data = loadData();
      const task = data.find(p => p.id === projId)
        .checkpoints.find(c => c.id === cpId)
        .tasks.find(t => t.id === taskId);
      task.text = newText;
      saveData(data);
      renderProjects();
    } else {
      cancelEdit();
    }
  }

  function cancelEdit() {
    input.replaceWith(span);
  }

  input.onkeydown = function(e) {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') cancelEdit();
  };
  input.onblur = cancelEdit;
}

function completeProject(projectId) {
  const data = loadData();
  const proj = data.find(p => p.id === projectId);
  if (proj) {
    // Check if all tasks are completed
    const allTasksCompleted = proj.checkpoints.every(cp => 
      cp.tasks.length > 0 && cp.tasks.every(task => task.completed)
    );
    
    if (allTasksCompleted) {
      proj.completed = true;
      saveData(data);
      renderProjects();
    }
  }
}

function setActiveProject(projectId) {
  activeProjectId = projectId;
  localStorage.setItem('activeProjectId', projectId);
  renderProjects();
}

// ===== SEGMENTED CONTROL COMPONENT =====
class SegmentedControl {
  constructor({
    container,
    options = [],
    initial = 0,
    onChange = () => {}
  }) {
    this.container = container;
    this.options = options;
    this.activeIndex = initial;
    this.onChange = onChange;
    this.segmentRefs = [];
    this.highlight = null;
    this.render();
  }

  render() {
    this.container.classList.add('segmented-control');
    this.container.innerHTML = '';
    const segments = document.createElement('div');
    segments.className = 'segments';
    this.highlight = document.createElement('div');
    this.highlight.className = 'highlight';
    segments.appendChild(this.highlight);
    this.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'segment-btn';
      btn.textContent = opt;
      if (i === this.activeIndex) btn.classList.add('active');
      btn.onclick = () => this.setActive(i);
      this.segmentRefs.push(btn);
      segments.appendChild(btn);
    });
    this.container.appendChild(segments);
    setTimeout(() => this.updateHighlight(), 10);
  }

  setActive(idx) {
    if (idx === this.activeIndex) return;
    this.segmentRefs[this.activeIndex].classList.remove('active');
    this.activeIndex = idx;
    this.segmentRefs[this.activeIndex].classList.add('active');
    this.updateHighlight();
    this.onChange(this.options[this.activeIndex], this.activeIndex);
  }

  updateHighlight() {
    const btn = this.segmentRefs[this.activeIndex];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const parentRect = btn.parentNode.getBoundingClientRect();
    this.highlight.style.width = rect.width + 'px';
    this.highlight.style.transform = `translateX(${rect.left - parentRect.left}px)`;
  }

  get value() {
    return this.options[this.activeIndex];
  }
}

// ===== INSERT SEGMENTED CONTROL ABOVE CLOCK =====
const segControlDiv = document.createElement('div');
segControlDiv.id = 'segmented-control-container';
timerContainer.parentNode.insertBefore(segControlDiv, timerContainer);

const segmented = new SegmentedControl({
  container: segControlDiv,
  options: ['Focus', 'Break', 'Long Break'],
  initial: 0,
  onChange: (value, idx) => {
    // Expose value for use elsewhere
    window.currentSegment = value;
    // Switch timer mode when segment changes
    if (value === 'Focus') switchMode('pomodoro');
    else if (value === 'Break') switchMode('short-break');
    else if (value === 'Long Break') switchMode('long-break');
  }
});

// Make segmented control available globally
window.segmented = segmented;
window.currentSegment = segmented.value;

// ===== SETTINGS MENU =====
const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const closeSettings = document.querySelector('.close-settings');

// Create overlay
const overlay = document.createElement('div');
overlay.className = 'settings-overlay';
document.body.appendChild(overlay);

function showFocusTimerSettings() {
  const content = settingsMenu.querySelector('.settings-content');
  content.innerHTML = '';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.innerHTML = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#6e00ff';
  backBtn.style.fontSize = '1rem';
  backBtn.style.padding = '8px 0';
  backBtn.style.cursor = 'pointer';
  backBtn.style.marginBottom = '16px';
  backBtn.onclick = populateSettingsMenu;
  content.appendChild(backBtn);

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Focus Timer';
  content.appendChild(title);

  // Timer Mode Multi-select
  const modeLabel = document.createElement('label');
  modeLabel.textContent = 'Select timer mode';
  modeLabel.style.display = 'block';
  modeLabel.style.margin = '18px 0 6px 0';
  content.appendChild(modeLabel);

  const modeSelect = document.createElement('select');
  modeSelect.style.fontSize = '1.1rem';
  modeSelect.style.padding = '8px 12px';
  modeSelect.style.borderRadius = '8px';
  modeSelect.style.background = '#111';
  modeSelect.style.color = '#fff';
  modeSelect.style.border = '1px solid #444';
  modeSelect.style.marginBottom = '18px';
  modeSelect.style.width = '180px';

  const timerModes = [
    { value: 'pomodoro', label: 'Pomodoro' },
    { value: 'stopwatch', label: 'Stopwatch' },
    { value: '52-17', label: '52/17' }
  ];
  timerModes.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    modeSelect.appendChild(option);
  });
  // Load from localStorage or default
  const savedMode = localStorage.getItem('timerMode') || 'pomodoro';
  modeSelect.value = savedMode;
  content.appendChild(modeSelect);

  // Timer Lengths Section
  const lengthsTitle = document.createElement('h3');
  lengthsTitle.textContent = 'Timer Lengths';
  content.appendChild(lengthsTitle);

  const note = document.createElement('div');
  note.textContent = 'Note: use Focus and Long Break for Animedoro.';
  note.style.fontSize = '0.95rem';
  note.style.color = '#aaa';
  note.style.marginBottom = '12px';
  content.appendChild(note);

  // Timer input fields
  const timerFields = [
    { id: 'focus', label: 'Focus', min: 1, max: 120 },
    { id: 'shortBreak', label: 'Short Break', min: 1, max: 60 },
    { id: 'longBreak', label: 'Long Break', min: 1, max: 60 },
    { id: 'countdown', label: 'Countdown', min: 1, max: 180 }
  ];
  const configData = JSON.parse(localStorage.getItem('pomodoroConfig')) || { pomodoro: 25, shortBreak: 5, longBreak: 15, countdown: 20 };
  const fieldRow = document.createElement('div');
  fieldRow.style.display = 'flex';
  fieldRow.style.gap = '24px';
  fieldRow.style.marginBottom = '18px';

  const fieldInputs = {};
  timerFields.forEach(f => {
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.alignItems = 'center';
    col.style.minWidth = '90px';
    const label = document.createElement('label');
    label.textContent = f.label;
    label.style.fontWeight = '600';
    label.style.marginBottom = '6px';
    col.appendChild(label);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = f.min;
    input.max = f.max;
    input.value = configData[f.id === 'focus' ? 'pomodoro' : f.id] || '';
    input.style.width = '60px';
    input.style.fontSize = '1.2rem';
    input.style.textAlign = 'center';
    input.style.borderRadius = '8px';
    input.style.border = '1px solid #444';
    input.style.background = '#111';
    input.style.color = '#fff';
    input.style.padding = '6px 0';
    fieldInputs[f.id] = input;
    col.appendChild(input);
    const mins = document.createElement('span');
    mins.textContent = 'mins';
    mins.style.fontSize = '0.95rem';
    mins.style.color = '#aaa';
    col.appendChild(mins);
    fieldRow.appendChild(col);
  });
  content.appendChild(fieldRow);

  // 52/17 logic
  function update52_17Fields() {
    if (modeSelect.value === '52-17') {
      fieldInputs.focus.value = 52;
      fieldInputs.shortBreak.value = 17;
      fieldInputs.focus.disabled = true;
      fieldInputs.shortBreak.disabled = true;
    } else {
      fieldInputs.focus.disabled = false;
      fieldInputs.shortBreak.disabled = false;
    }
  }
  modeSelect.addEventListener('change', () => {
    update52_17Fields();
  });
  update52_17Fields();

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.marginTop = '18px';
  saveBtn.style.padding = '10px 28px';
  saveBtn.style.fontSize = '1.1rem';
  saveBtn.style.background = '#6e00ff';
  saveBtn.style.color = '#fff';
  saveBtn.style.border = 'none';
  saveBtn.style.borderRadius = '8px';
  saveBtn.style.cursor = 'pointer';
  saveBtn.style.fontWeight = '600';
  saveBtn.style.letterSpacing = '0.5px';
  saveBtn.style.transition = 'background 0.2s';
  saveBtn.onmouseover = () => saveBtn.style.background = '#4a00b4';
  saveBtn.onmouseout = () => saveBtn.style.background = '#6e00ff';
  content.appendChild(saveBtn);

  saveBtn.onclick = () => {
    // Save config
    const newConfig = {
      pomodoro: parseInt(fieldInputs.focus.value),
      shortBreak: parseInt(fieldInputs.shortBreak.value),
      longBreak: parseInt(fieldInputs.longBreak.value),
      countdown: parseInt(fieldInputs.countdown.value)
    };
    localStorage.setItem('pomodoroConfig', JSON.stringify(newConfig));
    localStorage.setItem('timerMode', modeSelect.value);
    window.location.reload();
  };
}

function showStatsSection() {
  const content = settingsMenu.querySelector('.settings-content');
  content.innerHTML = '';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.innerHTML = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#6e00ff';
  backBtn.style.fontSize = '1rem';
  backBtn.style.padding = '8px 0';
  backBtn.style.cursor = 'pointer';
  backBtn.style.marginBottom = '16px';
  backBtn.onclick = populateSettingsMenu;
  content.appendChild(backBtn);

  // Header (no PLUS label)
  const title = document.createElement('h2');
  title.textContent = 'Focus Stats';
  title.style.marginBottom = '8px';
  content.appendChild(title);

  // Period buttons
  const periods = [
    { label: 'Today', value: 'today' },
    { label: '7 Days', value: '7d' },
    { label: '28 Days', value: '28d' }
  ];
  let selectedPeriod = 'today';
  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '12px';
  btnRow.style.marginBottom = '18px';
  const periodBtns = {};
  periods.forEach(p => {
    const btn = document.createElement('button');
    btn.textContent = p.label;
    btn.style.padding = '8px 18px';
    btn.style.fontSize = '1rem';
    btn.style.borderRadius = '8px';
    btn.style.border = 'none';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '600';
    btn.style.background = p.value === selectedPeriod ? '#a259ff' : '#18191c';
    btn.style.color = p.value === selectedPeriod ? '#fff' : '#ccc';
    btn.onclick = () => {
      selectedPeriod = p.value;
      updateStats();
      Object.keys(periodBtns).forEach(k => {
        periodBtns[k].style.background = k === selectedPeriod ? '#a259ff' : '#18191c';
        periodBtns[k].style.color = k === selectedPeriod ? '#fff' : '#ccc';
      });
    };
    periodBtns[p.value] = btn;
    btnRow.appendChild(btn);
  });
  content.appendChild(btnRow);

  // Stats row (only Focus, Tasks, Projects Completed)
  const statsRow = document.createElement('div');
  statsRow.style.display = 'flex';
  statsRow.style.gap = '64px'; // More spacing
  statsRow.style.marginBottom = '18px';
  statsRow.style.alignItems = 'flex-end';
  statsRow.style.justifyContent = 'center';
  content.appendChild(statsRow);

  // Stat blocks
  const statBlocks = {
    focus: { icon: '⚡', label: 'FOCUS', value: '0m 0s' },
    tasks: { icon: '✅', label: 'TASKS', value: '0' },
    projects: { icon: '📁', label: 'PROJECTS', value: '0' }
  };
  const statEls = {};
  Object.keys(statBlocks).forEach(k => {
    const block = document.createElement('div');
    block.style.display = 'flex';
    block.style.flexDirection = 'column';
    block.style.alignItems = 'center';
    block.style.minWidth = '90px';
    block.style.fontWeight = 'bold';
    block.style.fontSize = '1.1rem';
    const label = document.createElement('span');
    label.textContent = `${statBlocks[k].icon} ${statBlocks[k].label}`;
    label.style.fontWeight = '700';
    label.style.fontSize = '1.05rem';
    label.style.color = '#ccc';
    label.style.marginBottom = '2px';
    block.appendChild(label);
    const value = document.createElement('span');
    value.textContent = statBlocks[k].value;
    value.style.fontWeight = '700';
    value.style.fontSize = '2.2rem';
    value.style.marginTop = '2px';
    value.style.color = '#fff';
    statEls[k] = value;
    block.appendChild(value);
    statsRow.appendChild(block);
  });

  // Recent Productivity Title
  const recentTitle = document.createElement('div');
  recentTitle.textContent = 'Recent Productivity';
  recentTitle.style.fontWeight = '700';
  recentTitle.style.fontSize = '1.3rem';
  recentTitle.style.color = '#888';
  recentTitle.style.margin = '24px 0 8px 0';
  content.appendChild(recentTitle);

  // Chart container
  const chartDiv = document.createElement('div');
  chartDiv.id = 'stats-chart';
  chartDiv.style.width = '100%';
  chartDiv.style.height = '180px';
  chartDiv.style.background = '#18191c';
  chartDiv.style.borderRadius = '12px';
  chartDiv.style.marginBottom = '18px';
  content.appendChild(chartDiv);

  // Project breakdown section
  const projectBreakdownTitle = document.createElement('div');
  projectBreakdownTitle.textContent = 'Project Breakdown';
  projectBreakdownTitle.style.fontWeight = '700';
  projectBreakdownTitle.style.fontSize = '1.3rem';
  projectBreakdownTitle.style.color = '#888';
  projectBreakdownTitle.style.margin = '24px 0 8px 0';
  content.appendChild(projectBreakdownTitle);

  const projectBreakdownDiv = document.createElement('div');
  projectBreakdownDiv.id = 'project-breakdown';
  projectBreakdownDiv.style.marginBottom = '18px';
  content.appendChild(projectBreakdownDiv);

  // Stats calculation
  function updateStats() {
    // Get focusLog
    const focusLog = JSON.parse(localStorage.getItem('focusLog')) || [];
    const now = new Date();
    let start;
    if (selectedPeriod === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (selectedPeriod === '7d') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27);
    }

    // Filter log by period
    const filtered = focusLog.filter(e => new Date(e.timestamp) >= start);
    
    // Calculate total focus time
    const focusSeconds = filtered.length;
    const focusMins = Math.floor(focusSeconds / 60);
    const focusSecs = focusSeconds % 60;
    statEls.focus.textContent = `${focusMins}m ${focusSecs}s`;

    // Calculate completed tasks
    const data = loadData();
    const completedTasks = data.reduce((sum, proj) => 
      sum + proj.checkpoints.reduce((sum, cp) => 
        sum + cp.tasks.filter(t => t.completed).length, 0), 0);
    statEls.tasks.textContent = completedTasks;

    // Calculate completed projects
    const completedProjects = data.filter(p => p.completed).length;
    statEls.projects.textContent = completedProjects;

    // Update project breakdown
    const projectStats = {};
    filtered.forEach(entry => {
      let name = entry.projectName;
      if (!name || name === 'Unknown Project' || name === undefined) {
        name = 'No project selected';
      }
      if (!projectStats[name]) {
        projectStats[name] = 0;
      }
      projectStats[name]++;
    });

    // Sort projects by time spent
    const sortedProjects = Object.entries(projectStats)
      .sort(([,a], [,b]) => b - a);

    // Update project breakdown display
    projectBreakdownDiv.innerHTML = '';
    sortedProjects.forEach(([name, seconds]) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const projectDiv = document.createElement('div');
      projectDiv.style.display = 'flex';
      projectDiv.style.justifyContent = 'space-between';
      projectDiv.style.alignItems = 'center';
      projectDiv.style.padding = '12px';
      projectDiv.style.background = '#18191c';
      projectDiv.style.borderRadius = '8px';
      projectDiv.style.marginBottom = '8px';
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = name;
      nameSpan.style.fontWeight = '500';
      
      const timeSpan = document.createElement('span');
      timeSpan.textContent = `${mins}m ${secs}s`;
      timeSpan.style.color = '#6e00ff';
      
      projectDiv.appendChild(nameSpan);
      projectDiv.appendChild(timeSpan);
      projectBreakdownDiv.appendChild(projectDiv);
    });

    // Update chart
    updateChart(filtered);
  }

  function updateChart(data) {
    const ctx = document.createElement('canvas');
    chartDiv.innerHTML = '';
    chartDiv.appendChild(ctx);

    // Group data by day
    const dailyData = {};
    data.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleDateString();
      if (!dailyData[date]) {
        dailyData[date] = 0;
      }
      dailyData[date]++;
    });

    // Convert to minutes
    Object.keys(dailyData).forEach(date => {
      dailyData[date] = Math.floor(dailyData[date] / 60);
    });

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(dailyData),
        datasets: [{
          label: 'Focus Time (minutes)',
          data: Object.values(dailyData),
          backgroundColor: '#6e00ff',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888'
            }
          },
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            },
            ticks: {
              color: '#888'
            }
          }
        }
      }
    });
  }

  // Initial update
  updateStats();
}

function showProfileSection() {
  const content = settingsMenu.querySelector('.settings-content');
  content.innerHTML = '';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.innerHTML = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#6e00ff';
  backBtn.style.fontSize = '1rem';
  backBtn.style.padding = '8px 0';
  backBtn.style.cursor = 'pointer';
  backBtn.style.marginBottom = '16px';
  backBtn.onclick = populateSettingsMenu;
  content.appendChild(backBtn);

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Profile';
  content.appendChild(title);

  // Profile content
  const profileContent = document.createElement('div');
  profileContent.style.marginTop = '20px';

  // Total Focus Time
  const totalFocusTime = document.createElement('div');
  totalFocusTime.style.marginBottom = '20px';
  const focusLog = JSON.parse(localStorage.getItem('focusLog')) || [];
  const totalSeconds = focusLog.length;
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
  totalFocusTime.innerHTML = `
    <div style="font-size: 1.2rem; color: #888; margin-bottom: 8px;">Total Focus Time</div>
    <div style="font-size: 2rem; font-weight: bold;">${totalHours}h ${totalMinutes}m</div>
  `;
  profileContent.appendChild(totalFocusTime);

  // Completed Projects
  const completedProjects = document.createElement('div');
  const data = loadData();
  const completedCount = data.filter(p => p.completed).length;
  completedProjects.innerHTML = `
    <div style="font-size: 1.2rem; color: #888; margin-bottom: 8px;">Completed Projects</div>
    <div style="font-size: 2rem; font-weight: bold;">${completedCount}</div>
  `;
  profileContent.appendChild(completedProjects);

  content.appendChild(profileContent);
}

function showFeedbackSection() {
  const content = settingsMenu.querySelector('.settings-content');
  content.innerHTML = '';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.innerHTML = '← Back';
  backBtn.style.background = 'none';
  backBtn.style.border = 'none';
  backBtn.style.color = '#6e00ff';
  backBtn.style.fontSize = '1rem';
  backBtn.style.padding = '8px 0';
  backBtn.style.cursor = 'pointer';
  backBtn.style.marginBottom = '16px';
  backBtn.onclick = populateSettingsMenu;
  content.appendChild(backBtn);

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Feedback';
  content.appendChild(title);

  // Feedback content
  const feedbackContent = document.createElement('div');
  feedbackContent.style.marginTop = '20px';
  feedbackContent.innerHTML = `
    <div style="font-size: 1.1rem; color: #888; margin-bottom: 16px;">
      Have suggestions or found a bug? Contact us at:
    </div>
    <div style="font-size: 1.2rem; color: #6e00ff; font-weight: 500;">
      minimalistpomodoroapp@gmail.com
    </div>
  `;
  content.appendChild(feedbackContent);
}

// Update populateSettingsMenu to include new sections
function populateSettingsMenu() {
  const content = settingsMenu.querySelector('.settings-content');
  content.innerHTML = '';
  // Add menu options
  const options = [
    { icon: '⏰', label: 'Clock' },
    { icon: '⏱️', label: 'Focus Timer', onClick: showFocusTimerSettings },
    { icon: '📊', label: 'Stats', onClick: showStatsSection },
    { icon: '👤', label: 'Profile', onClick: showProfileSection },
    { icon: '💬', label: 'Feedback', onClick: showFeedbackSection }
  ];
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'settings-menu-item';
    btn.innerHTML = `<span style="font-size:1.3em; margin-right:10px;">${opt.icon}</span> <span>${opt.label}</span>`;
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '10px';
    btn.style.width = '100%';
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.color = '#fff';
    btn.style.fontSize = '1.1rem';
    btn.style.padding = '14px 18px';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.style.transition = 'background 0.2s';
    btn.onmouseover = () => btn.style.background = 'rgba(110,0,255,0.15)';
    btn.onmouseout = () => btn.style.background = 'none';
    if (opt.onClick) btn.onclick = opt.onClick;
    content.appendChild(btn);
  });
}

// Call populateSettingsMenu when opening settings
function toggleSettings() {
  if (!settingsMenu.classList.contains('active')) {
    populateSettingsMenu();
  }
  settingsMenu.classList.toggle('active');
  overlay.classList.toggle('active');
  document.body.style.overflow = settingsMenu.classList.contains('active') ? 'hidden' : '';
}

settingsBtn.addEventListener('click', toggleSettings);
closeSettings.addEventListener('click', toggleSettings);
overlay.addEventListener('click', toggleSettings);

// Close settings with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsMenu.classList.contains('active')) {
    toggleSettings();
  }
});

// ===== FOCUS TIME TRACKING =====
function logFocusSecond() {
  if (currentMode !== 'pomodoro' || !isRunning || !activeProjectId) return;
  
  const now = new Date();
  const entry = {
    timestamp: now.toISOString(),
    projectId: activeProjectId,
    mode: currentMode,
    projectName: getProjectName(activeProjectId)
  };
  
  let focusLog = JSON.parse(localStorage.getItem('focusLog')) || [];
  focusLog.push(entry);
  localStorage.setItem('focusLog', JSON.stringify(focusLog));
}

// Helper function to get project name
function getProjectName(projectId) {
  const data = loadData();
  const project = data.find(p => p.id === projectId);
  return project ? project.title : 'Unknown Project';
}

// ===== INIT =====