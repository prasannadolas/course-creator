
function openExploreModal() {
  const modal = $('explore-modal');
  if (modal) modal.classList.add('active');
}

function closeExploreModal(event) {
  // If event exists, only close if they clicked the overlay (not the card itself)
  if (event && event.target.id !== 'explore-modal' && event.type === 'click') return;
  const modal = $('explore-modal');
  if (modal) modal.classList.remove('active');
}

// Filters the rendered list of topics based on user input
function filterExploreTopics() {
  const query = document.getElementById('explore-search-input').value.toLowerCase();
  const categories = document.querySelectorAll('.explore-category');

  categories.forEach(category => {
    const chips = category.querySelectorAll('.chip');
    let hasVisibleChip = false;

    chips.forEach(chip => {
      // Check if the text matches the search
      if (chip.textContent.toLowerCase().includes(query)) {
        chip.style.display = 'inline-flex';
        hasVisibleChip = true;
      } else {
        chip.style.display = 'none';
      }
    });

    // Hide the whole category header if no chips match inside it
    category.style.display = hasVisibleChip ? 'block' : 'none';
  });
}

function setTopicAndGo(topic) {
  $("topic-input").value = topic;
  updateCharCounter();
  
  // Instantly close the modal so we can see the generation happen
  const exploreModal = $('explore-modal');
  if (exploreModal) exploreModal.classList.remove('active');
  
  startGeneration();
}