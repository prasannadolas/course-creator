// ── GLOBAL STATE ───────────────────────────────────────────────────────────
let currentView = 'overview';
let isRunning = false;
let isErrored = false;
let stopRequested = false;
let lastTopic = '';
let lastAudience = 'Beginners';
let lastFormat = 'Course';
let eventSource = null;
const API = ""; 
window._fullCourseContent = '';

// ── AUTHENTICATION & HISTORY LOGIC ─────────────────────────────────────────
function checkAuthUI() {
  const token = localStorage.getItem("orchestrai_token");
  const userStr = localStorage.getItem("orchestrai_user");
  
  if (token && userStr) {
    const user = JSON.parse(userStr);
    
    // Hide BOTH auth buttons when logged in
    if ($('nav-login-btn')) $('nav-login-btn').style.display = 'none';
    if ($('nav-register-btn')) $('nav-register-btn').style.display = 'none'; // <--- Make sure this line exists!
    
    // Show the user menu
    if ($('user-menu')) $('user-menu').style.display = 'flex'
    
    // Set Profile Details
    if ($('header-user-name')) $('header-user-name').textContent = user.full_name.split(' ')[0];
    if ($('header-avatar')) {
      const initials = user.full_name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      $('header-avatar').textContent = initials;
    }
  } else {
    // Show BOTH auth buttons when logged out
    if ($('nav-login-btn')) $('nav-login-btn').style.display = 'inline-flex';
    if ($('nav-register-btn')) $('nav-register-btn').style.display = 'inline-flex';
    
    // Hide the user menu
    if ($('user-menu')) $('user-menu').style.display = 'none';
  }
}
// ── LOGIN MODAL LOGIC ──────────────────────────────────────────────────────
function showLoginModal() {
  const modal = $('login-required-modal');
  if (modal) modal.classList.add('active');
}

function closeLoginModal(event) {
  if (event && event.target.id !== 'login-required-modal' && event.type === 'click') return;
  const modal = $('login-required-modal');
  if (modal) modal.classList.remove('active');
}

// ── LOGOUT LOGIC ───────────────────────────────────────────────────────────
function confirmLogout() {
  const modal = $('logout-confirm-modal');
  if (modal) modal.classList.add('active');
}

function closeLogoutModal() {
  const modal = $('logout-confirm-modal');
  if (modal) modal.classList.remove('active');
}

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
  
  window.location.href = "/"; 
}

// Force refresh when navigating back
window.onpageshow = function(event) {
    if (event.persisted) {
        window.location.reload(); 
    }
    checkAuthUI();
};

// Security: If the user is on the login page but already has a token, send them home
if (window.location.pathname === '/login' && localStorage.getItem("orchestrai_token")) {
    window.location.href = "/";
}

// ── SIDEBAR & HISTORY LOGIC ────────────────────────────────────────────────
async function openHistorySidebar() {
  $('sidebar-overlay').classList.add('active');
  $('history-sidebar').classList.add('open');
  
  const list = $('sidebar-list');
  list.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">Fetching your courses...</div>';

  try {
    const res = await fetch('/api/history', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem("orchestrai_token")}` }
    });
    const data = await res.json();

    if (!data.ok || data.courses.length === 0) {
      list.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--text-muted);">You haven\'t saved any courses yet.</div>';
      return;
    }

    list.innerHTML = data.courses.map((course, index) => `
     <div class="history-card" onclick="viewCloudCourse(${index})">
        <div class="history-title">${escapeHtml(course.topic)}</div>
        <div class="history-meta">
          <span>${course.date}</span>
          <span style="color: var(--border-strong);">•</span>
          <span>${course.audience}</span>
        </div>
      </div>
    `).join('');

    window._cloudCourses = data.courses;

  } catch (err) {
    list.innerHTML = '<div style="text-align:center; padding: 40px; color: var(--danger);">Failed to load history.</div>';
  }
}

function closeHistorySidebar() {
  $('sidebar-overlay').classList.remove('active');
  $('history-sidebar').classList.remove('open');
}
function closeCourseReader() {
  const modal = $('course-reader-modal');
  if (modal) modal.classList.remove('active');
}

function viewCloudCourse(index) {
  closeHistorySidebar();
  const course = window._cloudCourses[index];
  
  const cleanTopic = course.topic.replace(' (Partial)', '');
  $('reader-title').textContent = cleanTopic;

  let processedMD = course.content;

  // ── 1. REMOVE THE SYLLABUS SECTION ENTIRELY ──
  // We locate the syllabus block and delete it completely before parsing
  const syllabusIndex = processedMD.indexOf('## Syllabus');
  if (syllabusIndex !== -1) {
      // Find where the actual lessons start
      const lessonStartIndex = processedMD.search(/\n#\s+(Module|Unit)\s+1[:\-]/i);
      
      if (lessonStartIndex > syllabusIndex) {
          let before = processedMD.substring(0, syllabusIndex);
          let after = processedMD.substring(lessonStartIndex);
          // By skipping the syllabus block entirely, it vanishes from the UI
          processedMD = before + after; 
      }
  }

  // ── 2. FIX SQUISHED PARAGRAPHS ──
  processedMD = processedMD.replace(/(?<!#)\n(Module \d+:)/gi, '\n\n**$1**');

  // ── 3. PARSE TO HTML ──
  const rawHtml = marked.parse(processedMD);
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = rawHtml;

  const newWrapper = document.createElement('div');
  
  // NOTE: The Audience metadata container has been completely removed here.

  let currentContent = newWrapper; 
  let isFirstH1 = true;
  let hasModuleOpened = false;

  // ── 4. STRICT ACCORDION BUILDING ──
  Array.from(tempDiv.children).forEach(child => {
    // Hide duplicate main titles and the raw markdown Audience text
    if (child.tagName === 'H1' && isFirstH1) { isFirstH1 = false; return; }
    if (child.tagName === 'P' && child.textContent.includes('Audience:')) return; 

    // STRICT RULES: Only trigger an accordion if it is a explicitly a Module header
    let isModule = child.tagName === 'H1' && child.textContent.toLowerCase().includes('module');

    if (isModule) {
      const details = document.createElement('details');
      details.className = 'course-accordion';
      
      // Open the very first module by default instead of the syllabus
      if (!hasModuleOpened) {
          details.open = true; 
          hasModuleOpened = true;
      }

      const summary = document.createElement('summary');
      summary.textContent = child.textContent.replace(/\*\*/g, ''); 
      details.appendChild(summary);

      currentContent = document.createElement('div');
      currentContent.className = 'accordion-content';
      details.appendChild(currentContent);

      newWrapper.appendChild(details);
    } else {
      if (child.tagName === 'H1') {
          const h2 = document.createElement('h2');
          h2.innerHTML = child.innerHTML;
          currentContent.appendChild(h2);
      } else {
          currentContent.appendChild(child.cloneNode(true));
      }
    }
  });

  $('reader-content').innerHTML = '';
  $('reader-content').appendChild(newWrapper);
  
  // ── 5. DOWNLOAD BUTTON ──
  const downloadBtnWrapper = document.createElement('div');
  downloadBtnWrapper.style.cssText = 'padding: 24px 0 12px; display: flex; justify-content: center; border-top: 1px solid var(--border); margin-top: 24px;';
  
  const downloadBtn = document.createElement('button');
  downloadBtn.className = 'btn btn-primary';
  downloadBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
    Download Full PDF
  `;
  
  downloadBtn.onclick = function() {
    downloadHistoryPDF(cleanTopic, course.content, this);
  };
  
  downloadBtnWrapper.appendChild(downloadBtn);
  $('reader-content').appendChild(downloadBtnWrapper);

  $('course-reader-modal').classList.add('active');
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
  if (downloadBtn) downloadBtn.disabled = running && !window._fullCourseContent;
}

// ── REAL BACKEND CONNECTION ────────────────────────────────────────────────
function startGeneration(forceLast = false) {
  // --- 1. NEW AUTHENTICATION CHECK ---
  const token = localStorage.getItem("orchestrai_token");
  if (!token) {
    showLoginModal(); // Pop up the container!
    return; // Stop the generation process entirely
  }
  // -----------------------------------

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

  // ── BUG FIX: Force the badge to reset on every new run ──
  const badge = $("pipeline-badge");
  const dot = $("pulse-dot");
  if (badge) badge.className = 'pipeline-badge running';
  if ($("badge-text")) $("badge-text").textContent = 'Running';
  if (dot) dot.style.display = 'block';
  // ────────────────────────────────────────────────────────

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
  
  // ── UNLOCK UI & SAVE PARTIAL COURSE ON ERROR ──
  if (d.label.includes('❌')) {
    isRunning = false;
    setButtonsState(false); 
    
    $("pipeline-badge").className = 'pipeline-badge error';
    $("badge-text").textContent = 'Error';
    $("pulse-dot").style.display = 'none';
    
    if (eventSource) {
        eventSource.close();
    }

    // NEW: If we managed to generate at least the syllabus or 1 module, save it!
    if (window._fullCourseContent && window._fullCourseContent.trim().length > 50) {
        fetch('/api/save_course', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem("orchestrai_token")}`
            },
            body: JSON.stringify({
                topic: lastTopic, // Tagged as partial so you know it crashed
                audience: lastAudience,
                content: window._fullCourseContent 
            })
        })
        .then(res => res.json())
        .then(data => {
            if(data.ok) {
                // Change the banner slightly so you know the partial save worked
                const bannerText = "Partial course salvaged & saved!";
                showSavedBanner(bannerText); 
            }
        })
        .catch(err => console.error("Cloud save failed for partial course:", err));
    }
  }
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

  window._fullCourseContent += `\n### Quiz: ${d.title}\n${d.content}\n\n`;
}

function handleDone(d) {
  setBadge(false);
  window._fullCourseContent = d.full_content; 
  
  $("empty-state").style.display = 'none';
  $("summary-status").textContent = '100%';
  setButtonsState(false);
  isRunning = false;

  fetch('/api/save_course', {
      method: 'POST',
      headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("orchestrai_token")}`
      },
      body: JSON.stringify({
          topic: lastTopic,
          audience: lastAudience,
          content: window._fullCourseContent 
      })
  })
  .then(res => res.json())
  .then(data => {
      if(data.ok) {
          showSavedBanner(); 
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
  // 1. Intercept [VISUALIZE: Concept] tags and convert them into HTML buttons
  const visualizerRegex = /\[VISUALIZE:\s*([^\]]+)\]/g;
  
  const processedMd = md.replace(visualizerRegex, (match, conceptName) => {
    // We use a specific class 'visualizer-pill' that we will style in CSS in Step 4
    return `<button class="visualizer-pill" onclick="openVisualizerSandbox('${escapeHtml(conceptName)}')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              Explore: ${escapeHtml(conceptName)}
            </button>`;
  });

  // 2. Parse the rest of the markdown normally
  marked.setOptions({ breaks: true, gfm: true });
  return marked.parse(processedMd);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── UNIFIED PDF GENERATOR (LIVE & HISTORY) ─────────────────────────────────

/// 1. The main template engine that formats the layout
function generatePDFHTML(topic, rawContent) {
  const cleanTopic = topic.replace(' (Partial)', '');
  const dateStr = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

  // Fix the "squished syllabus" bug by forcing a double newline before every module
  let processedMD = rawContent.replace(/\n(Module \d+:)/gi, '\n\n$1');
  const rawHtml = marked.parse(processedMD);

  // Create a temporary DOM to precisely manipulate the layout before printing
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = rawHtml;

  // NEW: Create a dedicated wrapper to center the Syllabus vertically
  const children = Array.from(tempDiv.children);
  let inSyllabus = false;
  let syllabusWrapper = null;

  children.forEach(child => {
    if (child.tagName === 'H2' && child.textContent.toLowerCase().includes('syllabus')) {
      inSyllabus = true;
      syllabusWrapper = document.createElement('div');
      syllabusWrapper.className = 'syllabus-wrapper';
      child.parentNode.insertBefore(syllabusWrapper, child);
      syllabusWrapper.appendChild(child);
    } else if (child.tagName === 'H1') {
      inSyllabus = false;
    } else if (inSyllabus && child.tagName === 'P') {
      // Wrap syllabus items in a beautiful card class and move into the centered wrapper
      child.className = 'syllabus-box';
      syllabusWrapper.appendChild(child);
    }
  });

  // Hide the raw duplicate headers that we are handling via the Cover Page
  const firstH1 = tempDiv.querySelector('h1');
  if (firstH1) firstH1.style.display = 'none';
  const audienceP = Array.from(tempDiv.querySelectorAll('p')).find(p => p.textContent.includes('Audience:'));
  if (audienceP) audienceP.style.display = 'none';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(cleanTopic)} - Course PDF</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Fraunces:ital,wght@0,400;0,600;1,400&display=swap');
  
  /* PERFECT PAGE PADDING & MARGINS */
  @page { size: A4; margin: 25mm 20mm; }
  body { 
    font-family: 'DM Sans', sans-serif; font-size: 11pt; color: #222; 
    line-height: 1.7; max-width: 800px; margin: 0 auto; 
  }

  /* PAGE 1: CENTERED COVER PAGE */
  .cover-page { 
    height: 90vh; display: flex; flex-direction: column; justify-content: center; 
    align-items: center; text-align: center; page-break-after: always; 
  }
  .cover-title { 
    font-family: 'Fraunces', serif; font-size: 38pt; font-weight: 600; 
    color: #1a6b4a; margin-bottom: 24px; line-height: 1.15; 
  }
  .cover-meta { font-size: 14pt; color: #555; font-weight: 600; margin-bottom: 6px; }
  .cover-credit { font-size: 13pt; color: #1a6b4a; font-weight: 700; margin-bottom: 24px; }
  .cover-time { font-size: 11pt; color: #888; }

  /* PAGE 2: CENTERED SYLLABUS PAGE */
  .syllabus-wrapper {
    height: 90vh; 
    display: flex; 
    flex-direction: column; 
    justify-content: center;
    page-break-after: always;
  }
  .syllabus-wrapper h2 {
    text-align: center;
    font-size: 24pt;
    color: #1a6b4a;
    margin-top: 0;
    margin-bottom: 32px;
    border-bottom: none;
  }
  .syllabus-box { 
    background: #f8fbf9; border: 1px solid #d1eadf; border-left: 4px solid #1a6b4a; 
    padding: 16px 20px; border-radius: 8px; margin-bottom: 16px; 
    page-break-inside: avoid; text-align: left; 
  }

  /* PAGE 3+: CONTENT TYPOGRAPHY */
  p { margin-bottom: 16px; text-align: justify; hyphens: auto; }
  
  /* FORCED PAGE BREAKS FOR MODULES */
  h1 { 
    page-break-before: always; 
    font-size: 22pt; color: #1a6b4a; margin-top: 0; padding-bottom: 8px; 
    border-bottom: 2px solid #e8f4ee; margin-bottom: 24px; 
  }
  h2 { font-size: 18pt; color: #111; margin-top: 28px; margin-bottom: 16px; }
  h3 { font-size: 14pt; color: #333; margin-top: 20px; margin-bottom: 12px; }

  /* CODE & TABLES */
  pre { 
    background: #f5f5f5; padding: 16px; border-radius: 8px; font-size: 9.5pt; 
    font-family: 'Courier New', Courier, monospace; white-space: pre-wrap; 
    word-wrap: break-word; page-break-inside: avoid; margin-bottom: 16px; 
  }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 4px; color: #d63384; font-family: monospace; font-size: 0.95em; }
  pre code { background: none; padding: 0; color: #333; }
  ul, ol { margin-bottom: 16px; padding-left: 24px; }
  li { margin-bottom: 8px; text-align: left; }
  blockquote { border-left: 4px solid #1a6b4a; padding-left: 16px; margin: 16px 0; color: #555; font-style: italic; }
</style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-title">${escapeHtml(cleanTopic)}</div>
    <div class="cover-meta">Generated by EduGenesis</div>
    <div class="cover-credit">Built by Prasanna Dolas</div>
  </div>
  <div class="content-wrapper">
    ${tempDiv.innerHTML}
  </div>
  <script>
    // Triggers the print dialog automatically when the tab opens
    window.onload = () => { setTimeout(() => window.print(), 500); };
  </script>
</body>
</html>`;
}

// 2. The trigger that creates the blob and opens the print tab
function executePDFDownload(htmlContent, safeFilename, btn, originalText) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');

  if (!win) { // Fallback if pop-ups are blocked
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename.replace('.pdf', '.html');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    alert("Pop-up blocked! The file was saved as HTML instead. Open the HTML file and press Ctrl+P to save as PDF.");
  } else {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  if (btn) {
    setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 1500);
  }
}

// 3. Connect the LIVE pipeline button
function downloadPDF() {
  if (!window._fullCourseContent || window._fullCourseContent.trim().length < 50) {
    showError('No Content Yet', 'Wait for at least one module to finish generating.');
    return;
  }
  const dlBtn = $("download-btn");
  const originalText = dlBtn ? dlBtn.innerHTML : 'Download PDF';
  if (dlBtn) { dlBtn.innerHTML = 'Preparing PDF…'; dlBtn.disabled = true; }

  const rawTopic = ($("pipeline-course-title") ? $("pipeline-course-title").textContent : 'Course').trim();
  const safeFilename = rawTopic.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_course.pdf';
  
  const htmlContent = generatePDFHTML(rawTopic, window._fullCourseContent);
  executePDFDownload(htmlContent, safeFilename, dlBtn, originalText);
}

// 4. Connect the HISTORY modal button
function downloadHistoryPDF(topic, content, btn) {
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Preparing PDF…';
  btn.disabled = true;

  const cleanTopic = topic.replace(' (Partial)', '');
  const safeFilename = cleanTopic.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_course.pdf';
  
  const htmlContent = generatePDFHTML(cleanTopic, content);
  executePDFDownload(htmlContent, safeFilename, btn, originalText);
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
function showSavedBanner(customText) {
  if ($('saved-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'saved-banner';
  banner.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#1a6b4a;color:#fff;padding:14px 20px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.18);font-size:14px;font-weight:500;display:flex;align-items:center;gap:10px;opacity:0;transition:opacity 0.3s ease,transform 0.3s ease;transform:translateY(10px);';
  const text = customText || 'Course saved — survives refresh!';
  banner.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg> ${text}`;  
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
  
  $('modal-agent-name').textContent = data.name;
  $('modal-agent-desc').textContent = data.desc;
  
  const ul = $('modal-agent-work');
  ul.innerHTML = '';
  data.work.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    ul.appendChild(li);
  });
  
  setTimeout(() => {
    $('agent-modal').classList.add('active');
  }, 10);
}

function closeAgentModal(event) {
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
    if (window.scrollY > 20) {
      topbar.classList.add('scrolled');
    } else {
      topbar.classList.remove('scrolled');
    }
  }
});

// ── VISUALIZER SANDBOX LOGIC ───────────────────────────────────────────────
async function openVisualizerSandbox(conceptName) {
  const modal = $('visualizer-modal');
  if (!modal) return;

  $('visualizer-title').textContent = conceptName;
  const contentContainer = $('visualizer-content');
  
  // 1. Show Loading State
  contentContainer.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color: var(--text-muted); text-align:center; padding: 40px;">
      <div class="spinner" style="display:block; width:36px; height:36px; border: 3px solid var(--border-strong); border-top-color: var(--accent); margin-bottom:20px;"></div>
      <p style="font-size: 16px; color: var(--text-primary); font-weight: 600; margin-bottom: 8px;">
        Generating Interactive Sandbox
      </p>
      <p style="font-size: 14px; max-width: 300px;">
        Writing real-time visualization code to map out <strong>${escapeHtml(conceptName)}</strong>...
      </p>
    </div>
  `;
  modal.classList.add('active');

  // 2. LAZY LOAD: Fetch the code from the backend only when clicked
  try {
    const res = await fetch(`/api/visualize?concept=${encodeURIComponent(conceptName)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem("orchestrai_token")}` }
    });
    const data = await res.json();

    if (data.ok) {
      // Inject the raw HTML
      contentContainer.innerHTML = data.html;
      
      // 3. SECURE EXECUTION: Browsers block <script> tags injected via innerHTML. 
      // We must manually extract and re-append them to force execution!
      Array.from(contentContainer.querySelectorAll("script")).forEach(oldScript => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    contentContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color: var(--danger); text-align:center;">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px;">
          <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p style="font-weight: 600;">Sandbox Generation Failed</p>
        <p style="font-size: 13px; color: var(--text-secondary); margin-top: 8px;">The visualization agent hit an API limit. Try again in a minute.</p>
      </div>`;
  }
}

function closeVisualizerSandbox(event) {
  if (event && event.target.id !== 'visualizer-modal' && event.type === 'click') return;
  const modal = $('visualizer-modal');
  if (modal) {
      modal.classList.remove('active');
      // Clear the content so any running animations/scripts stop completely
      if ($('visualizer-content')) $('visualizer-content').innerHTML = ''; 
  }
}

/// 1. The main template engine that formats the layout
function generatePDFHTML(topic, rawContent) {
  const cleanTopic = topic.replace(' (Partial)', '');
  const dateStr = new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });

  // Fix the "squished syllabus" bug by forcing a double newline before every module
  let processedMD = rawContent.replace(/\n(Module \d+:)/gi, '\n\n$1');
  const rawHtml = marked.parse(processedMD);

  // Create a temporary DOM to precisely manipulate the layout before printing
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = rawHtml;

  // NEW: Create a dedicated wrapper to center the Syllabus vertically
  const children = Array.from(tempDiv.children);
  let inSyllabus = false;
  let syllabusWrapper = null;

  children.forEach(child => {
    if (child.tagName === 'H2' && child.textContent.toLowerCase().includes('syllabus')) {
      inSyllabus = true;
      syllabusWrapper = document.createElement('div');
      syllabusWrapper.className = 'syllabus-wrapper';
      child.parentNode.insertBefore(syllabusWrapper, child);
      syllabusWrapper.appendChild(child);
    } else if (child.tagName === 'H1') {
      inSyllabus = false;
    } else if (inSyllabus && child.tagName === 'P') {
      // Wrap syllabus items in a beautiful card class and move into the centered wrapper
      child.className = 'syllabus-box';
      syllabusWrapper.appendChild(child);
    }
  });

  // Hide the raw duplicate headers that we are handling via the Cover Page
  const firstH1 = tempDiv.querySelector('h1');
  if (firstH1) firstH1.style.display = 'none';
  const audienceP = Array.from(tempDiv.querySelectorAll('p')).find(p => p.textContent.includes('Audience:'));
  if (audienceP) audienceP.style.display = 'none';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${escapeHtml(cleanTopic)} - Course PDF</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Fraunces:ital,wght@0,400;0,600;1,400&display=swap');
  
  /* PERFECT PAGE PADDING & MARGINS */
  @page { size: A4; margin: 25mm 20mm; }
  body { 
    font-family: 'DM Sans', sans-serif; font-size: 11pt; color: #222; 
    line-height: 1.7; max-width: 800px; margin: 0 auto; 
  }

  /* PAGE 1: CENTERED COVER PAGE */
  .cover-page { 
    height: 90vh; display: flex; flex-direction: column; justify-content: center; 
    align-items: center; text-align: center; page-break-after: always; 
  }
  .cover-title { 
    font-family: 'Fraunces', serif; font-size: 38pt; font-weight: 600; 
    color: #1a6b4a; margin-bottom: 24px; line-height: 1.15; 
  }
  .cover-meta { font-size: 14pt; color: #555; font-weight: 600; margin-bottom: 6px; }
  .cover-credit { font-size: 13pt; color: #1a6b4a; font-weight: 700; margin-bottom: 24px; }
  .cover-time { font-size: 11pt; color: #888; }

  /* PAGE 2: CENTERED SYLLABUS PAGE */
  .syllabus-wrapper {
    height: 90vh; 
    display: flex; 
    flex-direction: column; 
    justify-content: center;
    page-break-after: always;
  }
  .syllabus-wrapper h2 {
    text-align: center;
    font-size: 24pt;
    color: #1a6b4a;
    margin-top: 0;
    margin-bottom: 32px;
    border-bottom: none;
  }
  .syllabus-box { 
    background: #f8fbf9; border: 1px solid #d1eadf; border-left: 4px solid #1a6b4a; 
    padding: 16px 20px; border-radius: 8px; margin-bottom: 16px; 
    page-break-inside: avoid; text-align: left; 
  }

  /* PAGE 3+: CONTENT TYPOGRAPHY */
  p { margin-bottom: 16px; text-align: justify; hyphens: auto; }
  
  /* FORCED PAGE BREAKS FOR MODULES */
  h1 { 
    page-break-before: always; 
    font-size: 22pt; color: #1a6b4a; margin-top: 0; padding-bottom: 8px; 
    border-bottom: 2px solid #e8f4ee; margin-bottom: 24px; 
  }
  h2 { font-size: 18pt; color: #111; margin-top: 28px; margin-bottom: 16px; }
  h3 { font-size: 14pt; color: #333; margin-top: 20px; margin-bottom: 12px; }

  /* CODE & TABLES */
  pre { 
    background: #f5f5f5; padding: 16px; border-radius: 8px; font-size: 9.5pt; 
    font-family: 'Courier New', Courier, monospace; white-space: pre-wrap; 
    word-wrap: break-word; page-break-inside: avoid; margin-bottom: 16px; 
  }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 4px; color: #d63384; font-family: monospace; font-size: 0.95em; }
  pre code { background: none; padding: 0; color: #333; }
  ul, ol { margin-bottom: 16px; padding-left: 24px; }
  li { margin-bottom: 8px; text-align: left; }
  blockquote { border-left: 4px solid #1a6b4a; padding-left: 16px; margin: 16px 0; color: #555; font-style: italic; }
</style>
</head>
<body>
  <div class="cover-page">
    <div class="cover-title">${escapeHtml(cleanTopic)}</div>
    <div class="cover-meta">Generated by EduGenesis</div>
    <div class="cover-credit">Built by Prasanna Dolas</div>
  </div>
  <div class="content-wrapper">
    ${tempDiv.innerHTML}
  </div>
  <script>
    // Triggers the print dialog automatically when the tab opens
    window.onload = () => { setTimeout(() => window.print(), 500); };
  </script>
</body>
</html>`;
}

// 2. The trigger that creates the blob and opens the print tab
function executePDFDownload(htmlContent, safeFilename, btn, originalText) {
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');

  if (!win) { // Fallback if pop-ups are blocked
    const a = document.createElement('a');
    a.href = url;
    a.download = safeFilename.replace('.pdf', '.html');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    alert("Pop-up blocked! The file was saved as HTML instead. Open the HTML file and press Ctrl+P to save as PDF.");
  } else {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  if (btn) {
    setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 1500);
  }
}

// 3. Connect the LIVE pipeline button
function downloadPDF() {
  if (!window._fullCourseContent || window._fullCourseContent.trim().length < 50) {
    showError('No Content Yet', 'Wait for at least one module to finish generating.');
    return;
  }
  const dlBtn = $("download-btn");
  const originalText = dlBtn ? dlBtn.innerHTML : 'Download PDF';
  if (dlBtn) { dlBtn.innerHTML = 'Preparing PDF…'; dlBtn.disabled = true; }

  const rawTopic = ($("pipeline-course-title") ? $("pipeline-course-title").textContent : 'Course').trim();
  const safeFilename = rawTopic.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_course.pdf';
  
  const htmlContent = generatePDFHTML(rawTopic, window._fullCourseContent);
  executePDFDownload(htmlContent, safeFilename, dlBtn, originalText);
}

// 4. Connect the HISTORY modal button
function downloadHistoryPDF(topic, content, btn) {
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Preparing PDF…';
  btn.disabled = true;

  const cleanTopic = topic.replace(' (Partial)', '');
  const safeFilename = cleanTopic.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_course.pdf';
  
  const htmlContent = generatePDFHTML(cleanTopic, content);
  executePDFDownload(htmlContent, safeFilename, btn, originalText);
}