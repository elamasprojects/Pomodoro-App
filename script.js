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
  applyBackground(); updateDisplay();
}
function tick() {
  if (timeLeft>0) {
    timeLeft--; updateDisplay();
  } else finishCycle();
}
function finishCycle() {
  clearInterval(timer); isRunning=false;
  guardarSesion();
  // auto switch
  if (currentMode==='pomodoro') switchMode('short-break');
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
startButton.addEventListener('click', ()=>{
  if (!isRunning) {
    timer = setInterval(tick,1000);
    isRunning = true;
  } else {
    clearInterval(timer);
    isRunning = false;
  }
  updateDisplay();
});
resetButton.addEventListener('click', ()=>{
  clearInterval(timer); isRunning=false;
  guardarSesion();
  timeLeft = modes[currentMode];
  updateDisplay();
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
    div.className='project';
    div.setAttribute('data-project-id', proj.id);
    // header
    const hdr = document.createElement('div'); 
    hdr.className='project-header';
    const titleContainer = document.createElement('div');
    titleContainer.className = 'project-title-container';
    const title = document.createElement('span'); 
    title.textContent=`${proj.emoji} ${proj.title}`;
    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    const progressText = document.createElement('span');
    progressText.className = 'progress-text';
    progressContainer.append(progressBar, progressText);
    titleContainer.append(title, progressContainer);
    const headerControls = document.createElement('div');
    headerControls.className = 'header-controls';
    const btnAddCP = document.createElement('button'); 
    btnAddCP.textContent='+ Add Checkpoint'; 
    btnAddCP.className = 'btn-add';
    btnAddCP.onclick=()=> showCheckpointForm(proj.id);
    // Check (complete) button
    const btnComplete = document.createElement('button');
    btnComplete.className = 'complete-btn';
    btnComplete.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="10" stroke="#4a90e2" stroke-width="2" fill="none"/><path d="M7 11.5L10 14.5L15 9.5" stroke="#4a90e2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    btnComplete.title = 'Mark as Completed';
    btnComplete.onclick = () => completeProject(proj.id);
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
    proj.completed = true;
    saveData(data);
    renderProjects();
  }
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
window.currentSegment = segmented.value;

// ===== INIT =====