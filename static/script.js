// ── GLOBAL STATE ───────────────────────────────────────────────────────────
let currentView = 'overview';
let isRunning = false;
let isErrored = false;
let stopRequested = false;
let lastTopic = '';
let lastAudience = 'Beginners';
let lastFormat = 'Course';
let eventSource = null;
window._fullCourseContent = '';

const sampleTopics = [
  'Machine Learning Fundamentals',
  'Full-Stack MERN Development',
  'Introduction to LLMs and RAG',
  'Building Agentic Workflows'
];

const $ = (id) => document.getElementById(id);

// ── UI ROUTING & HELPERS ───────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  $("panel-" + name).classList.add('active');
}

function setView(view) {
  currentView = view;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  const indexMap = { overview: 0, syllabus: 1, lessons: 2, quizzes: 3 };
  if (buttons[indexMap[view]]) buttons[indexMap[view]].classList.add('active');
  
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $("view-" + view).classList.add('active');
}

function updateCharCounter() {
  const input = $("topic-input");
  if (!input) return;
  const len = input.value.length;
  const counter = $("char-counter");
  if (counter) {
      counter.textContent = `${len} / 180`;
      counter.style.color = len > 160 ? 'var(--warn)' : 'var(--text-muted)';
  }
}

function fillSample() {
  const topic = sampleTopics[Math.floor(Math.random() * sampleTopics.length)];
  $("topic-input").value = topic;
  updateCharCounter();
  $("topic-input").focus();
}

function setTopicAndGo(topic) {
  $("topic-input").value = topic;
  updateCharCounter();
  startGeneration();
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ── ERROR HANDLING & RESETS ────────────────────────────────────────────────
function showError(title, sub) {
  isErrored = true;
  $("error-title").textContent = title;
  $("error-sub").textContent = sub;
  $("error-banner").classList.add('visible');
  $("pipeline-badge").className = 'pipeline-badge error';
  $("badge-text").textContent = 'Error';
  $("pulse-dot").style.display = 'none';
  
  const homeStatus = $("home-status");
  if (homeStatus) {
      homeStatus.className = 'status-chip status-error';
      homeStatus.textContent = 'Generation interrupted';
  }
  
  setProgress(0, 'Generation failed');
  isRunning = false;
  stopRequested = false;
  setButtonsState(false);
}

function dismissError() {
  $("error-banner").classList.remove('visible');
}

function retryLast() {
  dismissError();
  if (lastTopic) {
    $("topic-input").value = lastTopic;
    $("audience-select").value = lastAudience;
    $("format-select").value = lastFormat.toLowerCase();
    updateCharCounter();
    startGeneration();
  }
}

function resetAll() {
  $("topic-input").value = '';
  $("audience-select").value = 'Beginners';
  $("format-select").value = 'course';
  updateCharCounter();
  dismissError();
  stopRequested = false;
  window._fullCourseContent = '';
  $("syllabus-col").innerHTML = '';
  $("lessons-col").innerHTML = '';
  $("quizzes-col").innerHTML = '';
  $("empty-state").style.display = 'block';
  setProgress(0, 'Ready to start');
  $("summary-status").textContent = '0%';
  $("summary-modules").textContent = '0';
  $("summary-duration").textContent = '0h';
  $("summary-quizzes").textContent = '0';
  
  const homeStatus = $("home-status");
  if (homeStatus) {
      homeStatus.className = 'status-chip status-ready';
      homeStatus.textContent = 'Ready to generate';
  }
  
  resetPipelineUI();
  showPanel('home');
}

function resetPipelineUI() {
  for (let i = 0; i < 4; i++) resetStage(i);
  stopRequested = false;
  $("pipeline-badge").className = 'pipeline-badge running';
  $("badge-text").textContent = 'Running';
  $("pulse-dot").style.display = 'block';
  $("progress-fill").style.width = '0%';
  $("progress-pct").textContent = '0%';
  $("progress-label").textContent = 'Initializing agents...';
  $("pipeline-subtitle").textContent = 'Multi-agent pipeline running';
  $("empty-state").style.display = 'block';
  $("summary-status").textContent = '0%';
}

function setButtonsState(running) {
  const submitBtn = $("submit-btn");
  if (submitBtn) submitBtn.disabled = running;
  
  const demoFillBtn = $("demo-fill-btn");
  if (demoFillBtn) demoFillBtn.disabled = running;
  
  const clearBtn = $("clear-btn");
  if (clearBtn) clearBtn.disabled = running;
  
  const stopBtn = $("stop-btn");
  if (stopBtn) stopBtn.disabled = !running;
  
  const regenBtn = $("regenerate-btn");
  if (regenBtn) regenBtn.disabled = running;
  
  const downloadBtn = $("download-btn");
  if (downloadBtn) downloadBtn.disabled = running;
}

// ── REAL BACKEND CONNECTION ────────────────────────────────────────────────
function startGeneration(forceLast = false) {
  if (isRunning) return;
  dismissError();

  const topicInput = forceLast && lastTopic ? lastTopic : $("topic-input").value.trim();
  const audience = forceLast && lastTopic ? lastAudience : $("audience-select").value;
  const formatSelect = $("format-select");
  const format = forceLast && lastTopic ? lastFormat : (formatSelect ? formatSelect.value : 'course');

  if (forceLast && !lastTopic) {
    showError('Nothing to regenerate', 'Generate a course first, then use Regenerate to run it again.');
    return;
  }
  if (!topicInput) {
    showError('Topic is required', 'Please enter a course topic before generating.');
    return;
  }

  isRunning = true;
  isErrored = false;
  stopRequested = false;
  lastTopic = topicInput;
  lastAudience = audience;
  lastFormat = format;

  if (forceLast) {
    $('topic-input').value = topicInput;
    $('audience-select').value = audience;
    if (formatSelect) formatSelect.value = format;
  }

  showPanel('pipeline');
  setView('overview');
  setButtonsState(true);

  // UI Setup
  $("pipeline-course-title").textContent = topicInput;
  $("pipeline-subtitle").textContent = `Audience: ${audience} · ${capitalize(format)} · Multi-Agent Pipeline`;
  $("meta-audience").textContent = `Audience: ${audience}`;
  $("meta-format").textContent = `Format: ${capitalize(format)}`;
  $("meta-mode").textContent = 'Mode: Live Pipeline';

  $("syllabus-col").innerHTML = '';
  $("lessons-col").innerHTML = '';
  $("quizzes-col").innerHTML = '';
  $("empty-state").style.display = 'none';
  
  const homeStatus = $("home-status");
  if (homeStatus) {
      homeStatus.className = 'status-chip status-working';
      homeStatus.textContent = 'Generating course...';
  }
  
  window._fullCourseContent = "";
  
  // Reset overview stats
  $("summary-modules").textContent = '0';
  $("summary-quizzes").textContent = '0';
  $("summary-duration").textContent = '0h';

  setProgress(0, 'Connecting to backend agents...');
  for (let i = 0; i < 4; i++) resetStage(i);

  // Close existing stream if any
  if (eventSource) eventSource.close();

  // Connect to FastAPI SSE endpoint
  const url = `/generate?topic=${encodeURIComponent(topicInput)}&audience=${encodeURIComponent(audience)}`;
  eventSource = new EventSource(url);

  // Attach event listeners
  eventSource.addEventListener('stage', e => handleStage(JSON.parse(e.data)));
  eventSource.addEventListener('progress', e => handleProgress(JSON.parse(e.data)));
  eventSource.addEventListener('syllabus', e => {
      const data = JSON.parse(e.data);
      handleSyllabus(data);
      // Update Overview stats based on syllabus
      const moduleCount = data.text.split('\n').filter(l => l.trim()).length;
      $("summary-modules").textContent = String(moduleCount);
      $("summary-duration").textContent = `${Math.max(4, moduleCount * 3)}h`;
  });
  eventSource.addEventListener('module_start', e => handleModuleStart(JSON.parse(e.data)));
  eventSource.addEventListener('lesson_status', e => handleLessonStatus(JSON.parse(e.data)));
  eventSource.addEventListener('lesson_done', e => handleLessonDone(JSON.parse(e.data)));
  eventSource.addEventListener('quiz_done', e => {
      handleQuizDone(JSON.parse(e.data));
      // Increment quiz counter
      let currentQuizzes = parseInt($("summary-quizzes").textContent) || 0;
      $("summary-quizzes").textContent = String(currentQuizzes + 1);
  });
  
  eventSource.addEventListener('done', e => { 
    handleDone(JSON.parse(e.data)); 
    eventSource.close(); 
  });
  
  eventSource.onerror = () => { 
    const currentLabel = $("progress-label").textContent;
    if (!currentLabel.includes('❌') && !stopRequested) {
        showError('Connection error', 'Lost connection to the backend. Is the FastAPI server running?');
    }
    eventSource.close(); 
    setBadge(false);
  };
}

function stopGeneration() {
  if (!isRunning) return;
  stopRequested = true;
  
  if (eventSource) {
      eventSource.close();
  }

  $("progress-label").textContent = 'Stopping generation...';
  
  const homeStatus = $("home-status");
  if (homeStatus) {
      homeStatus.className = 'status-chip status-working';
      homeStatus.textContent = 'Stopping...';
  }
  
  handleStopped();
}

function regenerateCourse() {
  if (isRunning) return;
  if (!lastTopic) {
    showError('Nothing to regenerate', 'Generate a course first, then use Regenerate to run it again.');
    return;
  }
  startGeneration(true);
}

function handleStopped() {
  isRunning = false;
  isErrored = false;
  setButtonsState(false);
  $("pipeline-badge").className = 'pipeline-badge stopped';
  $("badge-text").textContent = 'Stopped';
  $("pulse-dot").style.display = 'none';
  $("progress-label").textContent = 'Generation stopped';
  
  const homeStatus = $("home-status");
  if (homeStatus) {
      homeStatus.className = 'status-chip status-ready';
      homeStatus.textContent = 'Generation stopped';
  }
  stopRequested = false;
}

// ── SSE HANDLERS ───────────────────────────────────────────────────────────
function handleStage(d) {
  if (d.status === 'active') activateStage(d.stage);
  else if (d.status === 'done') doneStage(d.stage);
}

function handleProgress(d) {
  setProgress(d.pct, d.label);
}

function handleSyllabus(d) {
  const col = $("syllabus-col");
  col.innerHTML = '';
  const lines = d.text.split('\n').filter(l => l.trim());
  
  lines.forEach((line, i) => {
    const cleanLine = line.replace(/\*\*/g, '').replace(/#/g, '').trim();
    col.innerHTML += `
      <div class="syllabus-module">
        <div class="module-num" id="mnum-${i}">${i+1}</div>
        <div class="module-text">
          <div class="module-title">${escapeHtml(cleanLine)}</div>
        </div>
      </div>`;
  });
}

function handleModuleStart(d) {
  const mnum = $("mnum-" + d.index);
  if (mnum) mnum.className = 'module-num active';

  $("lessons-col").innerHTML += `
    <div class="lesson-card" id="lesson-${d.index}">
      <div class="lesson-card-header">
        <div class="lesson-card-title">
          ${escapeHtml(d.title)}
          <span class="lesson-status-badge generating" id="lbadge-${d.index}">Drafting…</span>
        </div>
      </div>
      <div class="lesson-card-body" id="lbody-${d.index}">
        <div class="skeleton" style="height:12px;margin-bottom:8px;width:90%"></div>
        <div class="skeleton" style="height:12px;margin-bottom:8px;width:75%"></div>
        <div class="skeleton" style="height:12px;margin-bottom:8px;width:82%"></div>
      </div>
    </div>`;
}

function handleLessonStatus(d) {
  const badge = $("lbadge-" + d.index);
  if (badge) { 
    badge.textContent = 'Reviewing…'; 
    badge.className = 'lesson-status-badge reviewing'; 
  }
}

function handleLessonDone(d) {
  const badge = $("lbadge-" + d.index);
  if (badge) { 
    badge.textContent = 'Complete'; 
    badge.className = 'lesson-status-badge done'; 
  }

  const body = $("lbody-" + d.index);
  if (body) {
    let htmlContent = renderMarkdownLite(d.content);
    body.innerHTML = htmlContent;
    
    const card = $("lesson-" + d.index);
    if(card && !card.querySelector('.lesson-expand-btn')) {
      card.innerHTML += `<button class="lesson-expand-btn" onclick="toggleExpand(this)">Show full lesson ↓</button>`;
    }
  }

  const mnum = $("mnum-" + d.index);
  if (mnum) mnum.className = 'module-num done';
}

function handleQuizDone(d) {
  const questions = parseQuiz(d.content);
  let htmlQuiz = '';

  if (questions.length === 0) {
    htmlQuiz = renderMarkdownLite(d.content);
  } else {
    questions.forEach((q) => {
      htmlQuiz += `<div class="mcq-question">`;
      htmlQuiz += `<div class="mcq-question-text">${q.num}. ${escapeHtml(q.text)}</div>`;

      q.options.forEach(opt => {
        const isCorrect = opt.letter === q.correct;
        htmlQuiz += `<button class="mcq-option" onclick="checkAnswer(this, ${isCorrect})">
            <strong>${opt.letter.toUpperCase()})</strong> ${escapeHtml(opt.text)}
        </button>`;
      });
      
      htmlQuiz += `<div class="mcq-feedback"></div>`;
      htmlQuiz += `</div>`;
    });
  }

  $("quizzes-col").innerHTML += `
    <div class="quiz-card course-card">
      <div class="quiz-card-head">
        <div class="quiz-card-title">Module ${d.index + 1} Quiz</div>
      </div>
      <div class="quiz-card-body">${htmlQuiz}</div>
    </div>`;
}

function handleDone(d) {
  setBadge(false);
  window._fullCourseContent = d.full_content;
  $("empty-state").style.display = 'none';
  $("summary-status").textContent = '100%';
  
  const homeStatus = $("home-status");
  if (homeStatus) {
      homeStatus.className = 'status-chip status-ready';
      homeStatus.textContent = 'Ready to generate';
  }
  
  setButtonsState(false);
  isRunning = false;
}

// ── QUIZ PARSERS & LOGIC ───────────────────────────────────────────────────
function checkAnswer(btn, isCorrect) {
  const parent = btn.parentElement;
  const feedback = parent.querySelector('.mcq-feedback');
  const buttons = parent.querySelectorAll('.mcq-option');

  buttons.forEach(b => {
      b.disabled = true;
      b.style.cursor = 'default';
  });

  if (isCorrect) {
      btn.classList.add('correct');
      feedback.textContent = '✅ Correct!';
      feedback.style.color = 'var(--accent)';
  } else {
      btn.classList.add('wrong');
      feedback.textContent = '❌ Incorrect.';
      feedback.style.color = 'var(--warn)';

      buttons.forEach(b => {
          if(b.getAttribute('onclick').includes('true')) {
              b.classList.add('correct');
          }
      });
  }
  feedback.style.display = 'block';
}

function parseQuiz(text) {
  let questions = [];
  const parts = text.split(/(?:###|##|\*\*|---\n|\n---)\s*(?:Answer Key|Answers|Correct Answers)/i);
  const quizBody = parts[0];
  const answerKeyBody = parts.length > 1 ? parts[1] : "";

  let answers = {};
  if (answerKeyBody) {
      const ansRegex = /(\d+)[\.\:\-\)]\s*(?:\*\*)?([a-d])/gi;
      let match;
      while ((match = ansRegex.exec(answerKeyBody)) !== null) {
          answers[match[1]] = match[2].toLowerCase();
      }
  }

  const qRegex = /(?:^|\n)\s*\*?\*?(\d+)[\.\)]\s*\*?\*?([\s\S]*?)(?=(?:\n\s*\*?\*?\d+[\.\)]|$))/g;
  let qMatch;
  while ((qMatch = qRegex.exec(quizBody)) !== null) {
      let qNum = qMatch[1];
      let qBlock = qMatch[2].trim();

      const optRegex = /(?:^|\n)\s*([a-d])[\.\)]\s*(.*?)(?=(?:\n\s*[a-d][\.\)]|$))/gi;
      let options = [];
      let optMatch;
      let firstOptIndex = qBlock.length;

      while ((optMatch = optRegex.exec(qBlock)) !== null) {
          if(options.length === 0) firstOptIndex = optMatch.index;
          options.push({
              letter: optMatch[1].toLowerCase(),
              text: optMatch[2].trim().replace(/\*\*/g, '') 
          });
      }

      let qText = qBlock.substring(0, firstOptIndex).trim().replace(/\*\*/g, '');

      if (options.length > 0) {
          questions.push({
              num: qNum,
              text: qText,
              options: options,
              correct: answers[qNum] || null
          });
      }
  }
  return questions;
}

// ── UI RENDERING & COMPONENT HELPERS ───────────────────────────────────────
function toggleExpand(btn) {
  const body = btn.previousElementSibling;
  if(body.classList.contains('expanded')) {
    body.classList.remove('expanded');
    btn.textContent = "Show full lesson ↓";
  } else {
    body.classList.add('expanded');
    btn.textContent = "Collapse ↑";
  }
}

function renderMarkdownLite(md) {
  let safe = escapeHtml(md);
  safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/`([^`]+)`/g, '<code style="background:var(--surface2);padding:2px 6px;border-radius:6px;">$1</code>');
  safe = safe.replace(/\n/g, '<br>');
  return safe;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function downloadPDF() {
  if (!window._fullCourseContent) {
    showError('Nothing to export', 'Generate a course first before downloading the PDF file.');
    return;
  }

  const panel = $("panel-pipeline");
  if (!panel) {
    showError('Export unavailable', 'Could not find the course panel.');
    return;
  }

  // Clone to format nicely for PDF
  const clone = panel.cloneNode(true);
  clone.style.display = 'block';
  clone.style.position = 'fixed';
  clone.style.left = '-10000px';
  clone.style.top = '0';
  clone.style.width = '1024px';
  clone.style.background = '#ffffff';
  clone.style.padding = '24px';
  clone.style.boxSizing = 'border-box';
  clone.classList.add('pdf-capture');

  const toolbar = clone.querySelector('.toolbar');
  if (toolbar) toolbar.remove();
  const backBtn = clone.querySelector('.pipeline-back');
  if (backBtn) backBtn.remove();

  document.body.appendChild(clone);

  const topic = ($("pipeline-course-title").textContent || 'course').trim();
  const safeFilename = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_course.pdf';

  const opt = {
    margin: 0.35,
    filename: safeFilename,
    image: { type: 'jpeg', quality: 1 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  html2pdf().set(opt).from(clone).save().finally(() => {
    clone.remove();
  });
}

function resetStage(i) {
  const card = $("stage-"+i);
  const ind = $("stage-ind-"+i);
  card.className = 'stage-card pending';
  ind.className = 'stage-indicator pending-ind';
  ind.textContent = i+1;
  const shimmer = card.querySelector('.stage-shimmer');
  if (shimmer) shimmer.remove();
}

function activateStage(i) {
  const card = $("stage-"+i);
  const ind = $("stage-ind-"+i);
  card.className = 'stage-card active';
  ind.className = 'stage-indicator active-ind';
  if (!card.querySelector('.stage-shimmer')) {
    const shimmer = document.createElement('div');
    shimmer.className = 'stage-shimmer';
    card.appendChild(shimmer);
  }
}

function doneStage(i) {
  const card = $("stage-"+i);
  const ind = $("stage-ind-"+i);
  card.className = 'stage-card done';
  ind.className = 'stage-indicator done-ind';
  ind.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`;
  const shimmer = card.querySelector('.stage-shimmer');
  if (shimmer) shimmer.remove();
}

function setProgress(pct, label) {
  $("progress-fill").style.width = pct + '%';
  $("progress-pct").textContent = pct + '%';
  $("progress-label").textContent = label;
  $("summary-status").textContent = pct + '%';
}

function setBadge(running) {
  const badge = $("pipeline-badge");
  const dot = $("pulse-dot");
  const text = $("badge-text");
  if (running) {
    badge.className = 'pipeline-badge running';
    dot.style.display = 'block';
    text.textContent = 'Running';
  } else {
    badge.className = 'pipeline-badge done';
    dot.style.display = 'none';
    text.textContent = 'Complete';
  }
}

// ── INITIALIZATION ─────────────────────────────────────────────────────────
if ($("topic-input")) {
    $("topic-input").addEventListener('input', updateCharCounter);
}

window.addEventListener('load', () => {
  updateCharCounter();
  setProgress(0, 'Ready to start');
});