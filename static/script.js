// ── GLOBAL STATE ───────────────────────────────────────────────────────────
let currentView = 'overview';
let isRunning = false;
let isErrored = false;
let stopRequested = false;
let lastTopic = '';
let lastAudience = 'Beginners';
let lastFormat = 'Course';
let eventSource = null;
const API = ""; // <--- Add this line!
window._fullCourseContent = '';

// ── AUTHENTICATION & HISTORY LOGIC ─────────────────────────────────────────
function checkAuthUI() {
  const token = localStorage.getItem("orchestrai_token");
  const userStr = localStorage.getItem("orchestrai_user");
  
  if (token && userStr) {
    const user = JSON.parse(userStr);
    if ($('nav-login-btn')) $('nav-login-btn').style.display = 'none';
    if ($('user-menu')) $('user-menu').style.display = 'flex';
    
    // Set Profile Details
    if ($('header-user-name')) $('header-user-name').textContent = user.full_name.split(' ')[0];
    if ($('header-avatar')) {
      const initials = user.full_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      $('header-avatar').textContent = initials;
    }
  } else {
    if ($('nav-login-btn')) $('nav-login-btn').style.display = 'inline-flex';
    if ($('user-menu')) $('user-menu').style.display = 'none';
  }
}

// ── LOGOUT LOGIC ───────────────────────────────────────────────────────────
// ── UPDATED LOGOUT LOGIC ───────────────────────────────────────────────────
function confirmLogout() {
  // Show our custom modal instead of the browser's default confirm box
  const modal = $('logout-confirm-modal');
  if (modal) modal.classList.add('active');
}

function closeLogoutModal() {
  const modal = $('logout-confirm-modal');
  if (modal) modal.classList.remove('active');
}

// Ensure you also close the modal after logout to be safe
async function handleLogout() {
  closeLogoutModal(); 
  
  const token = localStorage.getItem("orchestrai_token");
  if (token) {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    }).catch(() => {});
  }
  localStorage.removeItem("orchestrai_token");
  localStorage.removeItem("orchestrai_user");
  
  // Redirect to home page instead of login page
  window.location.href = "/"; 
}

// Force refresh when navigating back
window.onpageshow = function(event) {
    if (event.persisted) {
        window.location.reload(); 
    }
    checkAuthUI(); // Re-verify auth state immediately
};

// Security: If the user is on the login page but already has a token, send them home
if (window.location.pathname === '/login' && localStorage.getItem("orchestrai_token")) {
    window.location.href = "/";
}

async function openHistoryModal() {
  const modal = $('history-modal');
  const list = $('history-list');
  modal.classList.add('active');
  list.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Fetching your courses from the cloud...</div>';

  try {
    const res = await fetch('/api/history', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem("orchestrai_token")}` }
    });
    const data = await res.json();

    if (!data.ok || data.courses.length === 0) {
      list.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">You haven\'t saved any courses yet.</div>';
      return;
    }

    // Render the list of courses
    list.innerHTML = data.courses.map((course, index) => `
      <div class="history-card" onclick="viewCloudCourse(${index})">
        <div class="history-title">${escapeHtml(course.topic)}</div>
        <div class="history-meta">
          <span>📅 ${course.date}</span>
          <span>👥 ${course.audience}</span>
        </div>
      </div>
    `).join('');

    // Save data temporarily so we can click on them
    window._cloudCourses = data.courses;

  } catch (err) {
    list.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--danger);">Failed to load history.</div>';
  }
}

function closeHistoryModal(event) {
  if (event && event.target.id !== 'history-modal') return;
  $('history-modal').classList.remove('active');
}

function viewCloudCourse(index) {
  const course = window._cloudCourses[index];
  const list = $('history-list');
  
  // Replace the list with a beautiful reader view of the selected course
  list.innerHTML = `
    <button class="btn btn-secondary" onclick="openHistoryModal()" style="margin-bottom: 16px;">&larr; Back to List</button>
    <div class="history-content-viewer lesson-card-body expanded">
      ${marked.parse(course.content)}
    </div>
  `;
}

// Check UI on page load
window.addEventListener('load', checkAuthUI);

// ── PERSISTENCE HELPERS (localStorage) ─────────────────────────────────────
const STORAGE_KEY = 'orchestrai_saved_course';

function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch(e) { console.warn('Storage save failed:', e); }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
}

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
  clearStorage();
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
  // Keep download enabled as long as some content exists (supports partial/stopped exports)
  if (downloadBtn) downloadBtn.disabled = running && !window._fullCourseContent;
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
      // Seed _fullCourseContent with title + syllabus immediately
      const topicTitle = $("pipeline-course-title").textContent || lastTopic;
      window._fullCourseContent = `# ${topicTitle}\n**Audience:** ${lastAudience}\n\n## Syllabus\n${data.text}\n\n`;
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

  // ── Incrementally build _fullCourseContent so partial stops can be exported ──
  window._fullCourseContent += `\n# ${d.title}\n\n${d.content}\n\n`;
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

  // Append quiz to running content so partial exports include it
  window._fullCourseContent += `\n### Quiz: ${d.title}\n${d.content}\n\n`;
}

function handleDone(d) {
  setBadge(false);
  window._fullCourseContent = d.full_content; // This is the full Markdown string
  
  // Update the UI
  $("empty-state").style.display = 'none';
  $("summary-status").textContent = '100%';
  setButtonsState(false);
  isRunning = false;

  // Save to the database via your FastAPI backend
  fetch('/api/save_course', {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("orchestrai_token")}`
      },
      body: JSON.stringify({
          topic: lastTopic,
          audience: lastAudience,
          content: window._fullCourseContent // We are sending the full markdown content
      })
  })
  .then(res => res.json())
  .then(data => {
      if(data.ok) {
          showSavedBanner(); // Visual feedback that it hit the cloud
      }
  })
  .catch(err => console.error("Cloud save failed:", err));
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
  // Tell marked to respect standard line breaks
  marked.setOptions({
    breaks: true,
    gfm: true // GitHub Flavored Markdown (enables tables and better code blocks)
  });
  
  // Parse the raw markdown into beautiful HTML
  return marked.parse(md);
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
  if (!window._fullCourseContent || window._fullCourseContent.trim().length < 50) {
    showError('No Content Yet', 'Wait for at least one module to finish generating, then click Download PDF.');
    return;
  }

  const dlBtn = $("download-btn");
  const originalText = dlBtn ? dlBtn.textContent : 'Download PDF';
  if (dlBtn) { dlBtn.textContent = 'Preparing PDF…'; dlBtn.disabled = true; }

  const isPartial = isRunning || (!isRunning && window._fullCourseContent && !$("badge-text")?.textContent?.includes('Complete'));
  const rawTopic = ($("pipeline-course-title") ? $("pipeline-course-title").textContent : 'Course').trim();
  const topic = rawTopic + (isPartial && $("badge-text") && $("badge-text").textContent === 'Stopped' ? ' (Partial)' : '');
  const safeFilename = topic.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_course.pdf';

  // ── Open PDF content in a new tab and trigger browser print-to-PDF ─────
  // This is the most reliable cross-browser approach — no canvas issues.
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(topic)} – Course</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', Arial, sans-serif; font-size: 14px; color: #1a1917; background: #fff; padding: 0; line-height: 1.7; }
  .cover { background: #1a6b4a; color: #fff; padding: 80px 60px; min-height: 220px; }
  .cover h1 { font-size: 36px; font-weight: 600; margin-bottom: 12px; }
  .cover .meta { font-size: 14px; opacity: 0.85; }
  .body-wrap { padding: 48px 60px; }
  h1 { font-size: 26px; color: #1a6b4a; border-bottom: 2px solid #e0f0e8; padding-bottom: 8px; margin: 48px 0 16px; page-break-before: always; }
  h1:first-of-type { page-break-before: auto; margin-top: 0; }
  h2 { font-size: 20px; color: #222; margin: 28px 0 10px; }
  h3 { font-size: 16px; color: #333; margin: 20px 0 8px; }
  p { margin-bottom: 12px; color: #222; }
  ul, ol { margin: 8px 0 16px 24px; }
  li { margin-bottom: 4px; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  pre { background: #f4f4f4; border: 1px solid #ddd; border-radius: 6px; padding: 16px; font-family: 'Courier New', monospace; font-size: 12.5px; white-space: pre-wrap; word-break: break-word; margin: 16px 0; page-break-inside: avoid; }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 12.5px; color: #c82c46; }
  pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
  blockquote { border-left: 4px solid #1a6b4a; padding-left: 14px; margin: 16px 0; color: #555; font-style: italic; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f0f8f4; font-weight: 600; }
  hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
  @media print {
    .no-print { display: none !important; }
    body { font-size: 13px; }
    h1 { page-break-before: always; }
    h1:first-of-type { page-break-before: auto; }
    pre { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="cover">
  <h1>${escapeHtml(topic)}</h1>
  <div class="meta">Generated by OrchestrAI &nbsp;·&nbsp; ${new Date().toLocaleDateString('en-IN', {year:'numeric',month:'long',day:'numeric'})}</div>
</div>
<div class="body-wrap">
${marked.parse(window._fullCourseContent)}
</div>
<script>
  // Auto-trigger print dialog once fonts/content load
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 800);
  });
<\/script>
</body></html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');

  if (!win) {
    // Fallback: direct download of the HTML (user can open & print)
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename.replace('.pdf', '.html');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showError('Pop-up Blocked', 'Allow pop-ups for this site, then click Download PDF again. Or use the downloaded HTML file — open it and press Ctrl+P → Save as PDF.');
  } else {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  if (dlBtn) {
    setTimeout(() => { dlBtn.textContent = originalText; dlBtn.disabled = false; }, 1500);
  }
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

// ── SAVED COURSE BANNER ────────────────────────────────────────────────────
function showSavedBanner() {
  if ($('saved-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'saved-banner';
  banner.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#1a6b4a;color:#fff;padding:14px 20px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.18);font-size:14px;font-weight:500;display:flex;align-items:center;gap:10px;opacity:0;transition:opacity 0.3s ease,transform 0.3s ease;transform:translateY(10px);';
  banner.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> Course saved — survives refresh!';
  document.body.appendChild(banner);
  setTimeout(() => { banner.style.opacity='1'; banner.style.transform='translateY(0)'; }, 50);
  setTimeout(() => { banner.style.opacity='0'; banner.style.transform='translateY(10px)'; }, 3500);
  setTimeout(() => banner.remove(), 4000);
}

// ── RESTORE SAVED COURSE ───────────────────────────────────────────────────
function restoreSavedCourse() {
  const saved = loadFromStorage();
  if (!saved || !saved.fullContent) return;

  window._fullCourseContent = saved.fullContent;
  lastTopic    = saved.topic    || '';
  lastAudience = saved.audience || 'Beginners';
  lastFormat   = saved.format   || 'Course';

  showPanel('pipeline');
  setView('overview');

  $("pipeline-course-title").textContent = saved.topic || 'Restored Course';
  $("pipeline-subtitle").textContent = 'Audience: ' + saved.audience + ' · ' + capitalize(saved.format) + ' · Restored from last session';
  $("meta-audience").textContent = 'Audience: ' + saved.audience;
  $("meta-format").textContent   = 'Format: ' + capitalize(saved.format);
  $("meta-mode").textContent     = 'Mode: Restored';

  $("summary-modules").textContent  = String(saved.modules  || 0);
  $("summary-duration").textContent = saved.duration || '0h';
  $("summary-quizzes").textContent  = String(saved.quizzes  || 0);
  $("summary-status").textContent   = '100%';
  $("empty-state").style.display    = 'none';

  if (saved.syllabusHTML) $("syllabus-col").innerHTML = saved.syllabusHTML;
  if (saved.lessonsHTML)  $("lessons-col").innerHTML  = saved.lessonsHTML;
  if (saved.quizzesHTML)  $("quizzes-col").innerHTML  = saved.quizzesHTML;

  setBadge(false);
  setProgress(100, 'Course restored from last session');
  setButtonsState(false);

  const notice = document.createElement('div');
  notice.id = 'restore-notice';
  notice.style.cssText = 'background:#e8f4ee;border:1px solid #b8dfc8;border-radius:10px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#1a6b4a;display:flex;align-items:center;justify-content:space-between;gap:12px;';
  const savedDate = saved.savedAt ? new Date(saved.savedAt).toLocaleString('en-IN') : '';
  notice.innerHTML = '<span>\uD83D\uDCC2 <strong>Restored:</strong> "' + escapeHtml(saved.topic) + '" — saved ' + savedDate + '</span><button onclick="clearSavedAndReset()" style="background:#1a6b4a;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;">Clear & Start New</button>';
  const overviewGrid = document.querySelector('.overview-grid');
  if (overviewGrid && overviewGrid.parentNode) overviewGrid.parentNode.insertBefore(notice, overviewGrid.nextSibling);

  document.querySelectorAll('.lesson-expand-btn').forEach(btn => {
    btn.onclick = function() { toggleExpand(this); };
  });
}

function clearSavedAndReset() {
  clearStorage();
  window._fullCourseContent = '';
  window.location.reload();
}

// ── INITIALIZATION ─────────────────────────────────────────────────────────
if ($("topic-input")) {
    $("topic-input").addEventListener('input', updateCharCounter);
}

window.addEventListener('load', () => {
  updateCharCounter();
  const saved = loadFromStorage();
  if (saved && saved.fullContent) {
    restoreSavedCourse();
  } else {
    setProgress(0, 'Ready to start');
  }
});

// ── AGENT MODAL LOGIC ──────────────────────────────────────────────────────
const agentData = {
  curriculum: {
    name: "Curriculum Agent ",
    desc: "The Master Planner. This agent is responsible for taking your raw topic and designing a logical, progressive learning path tailored to your selected audience.",
    work: [
      "Conducts initial research on the user's topic",
      "Breaks the subject down into digestible, sequential modules",
      "Ensures prerequisites are taught before advanced concepts"
    ]
  },
  professor: {
    name: "Content Agent",
    desc: "The Subject Matter Expert. This agent takes the skeleton syllabus and breathes life into it by writing comprehensive, engaging, and educational lesson content.",
    work: [
      "Drafts detailed Markdown content for each lesson",
      "Provides relevant code snippets, examples, and analogies",
      "Adapts the tone to fit beginners or advanced learners perfectly"
    ]
  },
  dean: {
    name: "Review Agent",
    desc: "The Quality Controller. Before any lesson reaches the user, The Dean reviews the Professor's work to ensure it meets strict educational standards.",
    work: [
      "Checks for factual accuracy and clarity of explanation",
      "Ensures the formatting is clean, consistent, and readable",
      "Flags and removes AI hallucinations or overly complex jargon"
    ]
  },
  exam: {
    name: "Quiz Agent",
    desc: "The Evaluator. To ensure knowledge retention, this agent reads the final approved lessons and generates targeted assessments.",
    work: [
      "Creates dynamic multiple-choice questions for each module",
      "Identifies the core concepts that need to be tested",
      "Provides accurate answer keys and plausible distractors (wrong answers)"
    ]
  }
};

function openAgentModal(agentKey) {
  const data = agentData[agentKey];
  if (!data) return;

  // BULLETPROOF CHECK: If the HTML is missing, inject it automatically!
  if (!$('agent-modal')) {
    const modalHTML = `
      <div class="modal-overlay" id="agent-modal" onclick="closeAgentModal(event)">
        <div class="modal-card" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h2 class="modal-title" id="modal-agent-name"></h2>
            <button class="modal-close" onclick="closeAgentModal()">&times;</button>
          </div>
          <div class="modal-body">
            <p id="modal-agent-desc"></p>
            <div class="modal-work-label">What this agent does:</div>
            <ul id="modal-agent-work" class="modal-work-list"></ul>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
  
  // Now it is safe to set the text
  $('modal-agent-name').textContent = data.name;
  $('modal-agent-desc').textContent = data.desc;
  
  const ul = $('modal-agent-work');
  ul.innerHTML = '';
  data.work.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
  
  // Tiny delay to allow the browser to draw the HTML before animating it in
  setTimeout(() => {
    $('agent-modal').classList.add('active');
  }, 10);
}

function closeAgentModal(event) {
  // If an event is passed, only close if the background overlay was clicked
  if (event && event.target.id !== 'agent-modal') return;
  const modal = $('agent-modal');
  if (modal) {
      modal.classList.remove('active');
  }
}

// ── DYNAMIC HEADER SCROLL EFFECT ───────────────────────────────────────────
window.addEventListener('scroll', () => {
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    // If we scroll down more than 20 pixels, add the glass effect
    if (window.scrollY > 20) {
      topbar.classList.add('scrolled');
    } else {
      // If we go back to the top, make it transparent again
      topbar.classList.remove('scrolled');
    }
  }
});

