// ── MY COURSES GRID MODAL LOGIC ────────────────────────────────────────────
async function openMyCoursesModal() {
  const modal = $('my-courses-modal');
  if (modal) modal.classList.add('active');
  
  const grid = $('my-courses-grid');
  // grid-column: 1 / -1 forces the loading text to span all 3 columns
  grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--text-muted);">Fetching your courses...</div>';

  try {
    const res = await fetch('/api/history', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem("orchestrai_token")}` }
    });
    const data = await res.json();

    if (!data.ok || data.courses.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--text-muted);">You haven\'t saved any courses yet.</div>';
      return;
    }

    // Save to global array so viewCloudCourse(index) works perfectly
    window._cloudCourses = data.courses;

    grid.innerHTML = data.courses.map((course, index) => `
     <div class="history-card" onclick="viewCloudCourse(${index})">
        
        <button class="history-delete-btn" onclick="deleteCloudCourse(${course.id}, event)" title="Delete Course">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>

        <div class="history-title">${escapeHtml(course.topic)}</div>
        <div class="history-meta">
          <span>${course.date}</span>
          <span style="color: var(--border-strong);">•</span>
          <span>${course.audience}</span>
        </div>
      </div>
    `).join('');

  } catch (err) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 40px; color: var(--danger);">Failed to load history.</div>';
  }
}

function closeMyCoursesModal(event) {
  // If event exists, only close if they clicked the overlay (not the card itself)
  if (event && event.target.id !== 'my-courses-modal' && event.type === 'click') return;
  const modal = $('my-courses-modal');
  if (modal) modal.classList.remove('active');
}

// ── COURSE READER MODAL LOGIC ──────────────────────────────────────────────

function closeCourseReader(event) {
  // Only close if they clicked the 'X' or the dark overlay background
  if (event && event.target.id !== 'course-reader-modal' && event.type === 'click') return;
  
  const modal = $('course-reader-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  
  // Instantly re-open the My Courses modal to create a "Back" behavior
  openMyCoursesModal();
}

function viewCloudCourse(index) {
  closeMyCoursesModal(); // <--- Change this line to close the modal instead of sidebar
  
  const course = window._cloudCourses[index];
  
  const cleanTopic = course.topic.replace(' (Partial)', '');
  $('reader-title').textContent = cleanTopic;

  let processedMD = course.content;

  // ── 1. REMOVE THE SYLLABUS SECTION ENTIRELY ──
  const syllabusIndex = processedMD.indexOf('## Syllabus');
  if (syllabusIndex !== -1) {
      const lessonStartIndex = processedMD.search(/\n#\s+(Module|Unit)\s+1[:\-]/i);
      if (lessonStartIndex > syllabusIndex) {
          let before = processedMD.substring(0, syllabusIndex);
          let after = processedMD.substring(lessonStartIndex);
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
  
  let currentContent = newWrapper; 
  let isFirstH1 = true;
  let hasModuleOpened = false;

  // ── 4. STRICT ACCORDION BUILDING ──
  Array.from(tempDiv.children).forEach(child => {
    if (child.tagName === 'H1' && isFirstH1) { isFirstH1 = false; return; }
    if (child.tagName === 'P' && child.textContent.includes('Audience:')) return; 

    let isModule = child.tagName === 'H1' && child.textContent.toLowerCase().includes('module');

    if (isModule) {
      const details = document.createElement('details');
      details.className = 'course-accordion';
      
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

async function deleteCloudCourse(courseId, event) {
  event.stopPropagation(); 

  if (!confirm("Are you sure you want to delete this course?")) {
    return;
  }

  try {
    const res = await fetch('/api/history/' + courseId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem("orchestrai_token") }
    });
    const data = await res.json();
    
    if (data.ok) {
      // Refresh the grid to instantly remove the deleted card
      openMyCoursesModal(); 
    } else {
      alert("Failed to delete course.");
    }
  } catch (err) {
    console.error(err);
    alert("An error occurred while deleting.");
  }
}

// ── MY COURSES MODAL INTERACTIVITY ─────────────────────────────────────────

// Toggles the search input box and focuses it
function toggleCourseSearch() {
  const searchContainer = document.getElementById('course-search-container');
  const searchInput = document.getElementById('course-search-input');
  
  if (searchContainer.style.display === 'none' || searchContainer.style.display === '') {
    searchContainer.style.display = 'block';
    searchInput.focus();
  } else {
    // Hide and reset search if clicked again
    searchContainer.style.display = 'none';
    searchInput.value = '';
    filterSavedCourses(); 
  }
}

// Filters the rendered list of courses based on user input
function filterSavedCourses() {
  const query = document.getElementById('course-search-input').value.toLowerCase();
  const cards = document.querySelectorAll('#my-courses-grid .history-card');
  
  cards.forEach(card => {
    // Look inside the .history-title element
    const title = card.querySelector('.history-title').textContent.toLowerCase();
    
    if (title.includes(query)) {
      card.style.display = 'flex'; // Use flex because we defined it as flex in CSS
    } else {
      card.style.display = 'none';
    }
  });
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