// script.js — module

const ANILIST_URL = 'https://graphql.anilist.co';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const mediaTypeSelect = document.getElementById('mediaType');
const sortSelect = document.getElementById('sortBy');
const resultsEl = document.getElementById('results');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModal = document.getElementById('closeModal');
const statusSelect = document.getElementById('statusSelect');
const saveStatusBtn = document.getElementById('saveStatus');

const myListEl = document.getElementById('myList');

const customEntryBtn = document.getElementById('customEntryBtn');
const customModal = document.getElementById('customModal');
const closeCustomModal = document.getElementById('closeCustomModal');
const customTitle = document.getElementById('customTitle');
const customType = document.getElementById('customType');
const customImg = document.getElementById('customImg');
const customStatus = document.getElementById('customStatus');
const customNotes = document.getElementById('customNotes');
const saveCustomEntry = document.getElementById('saveCustomEntry');

const cardTpl = document.getElementById('cardTpl');

let page = 1;
let perPage = 12;
let lastQuery = '';
let lastType = 'ANIME';
let lastSort = 'POPULARITY_DESC';
let lastResults = [];

// Debounce helper
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Build AniList GraphQL query for search
function buildSearchQuery(search, type, pageIdx, perPage, sort) {
  return {
    query: `
      query ($search: String, $type: MediaType, $page: Int, $perPage: Int, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total, currentPage, lastPage, perPage }
          media(search: $search, type: $type, sort: $sort) {
            id
            title { romaji english native }
            coverImage { large medium }
            genres
            averageScore
            meanScore
            episodes
            chapters
            volumes
            description(asHtml: false)
            startDate { year month day }
            status
            siteUrl
            format
            popularity
            favourites
          }
        }
      }
    `,
    variables: {
      search,
      type,
      page: pageIdx,
      perPage,
      sort: [sort]
    }
  };
}

// Generic fetch
async function fetchFromAniList(payload) {
  const resp = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error('Network / AniList error');
  const json = await resp.json();
  if (json.errors) {
    throw new Error(json.errors.map(e => e.message).join(', '));
  }
  return json.data;
}

// Render search results
function renderResults(mediaArray) {
  resultsEl.innerHTML = '';
  lastResults = mediaArray;

  if (!mediaArray || mediaArray.length === 0) {
    resultsEl.innerHTML = `<p style="color:var(--muted); grid-column:1/-1; text-align:center">No results</p>`;
    return;
  }

  mediaArray.forEach(item => {
    const node = cardTpl.content.cloneNode(true);
    const card = node.querySelector('.card');
    const img = node.querySelector('.cover');
    const title = node.querySelector('.card-title');
    const genres = node.querySelector('.genres');
    const score = node.querySelector('.score span');
    const viewBtn = node.querySelector('.viewBtn');
    const addBtn = node.querySelector('.addBtn');

    img.src = item.coverImage?.large || item.coverImage?.medium || '';
    img.alt = item.title.romaji || item.title.english || item.title.native || 'cover';
    title.textContent = item.title.romaji || item.title.english || item.title.native || 'Untitled';
    genres.textContent = (item.genres || []).slice(0, 4).join(', ') || '—';
    score.textContent = item.averageScore ?? item.meanScore ?? '—';

    viewBtn.addEventListener('click', () => openModal(item.id));
    addBtn.addEventListener('click', () => {
      openModal(item.id);
      statusSelect.value = 'PLANNING';
    });

    resultsEl.appendChild(node);
  });
}

// Perform a search
async function performSearch(q, type, pageIdx, sort) {
  try {
    resultsEl.innerHTML = `<p style="color:var(--muted); grid-column:1/-1; text-align:center">Loading…</p>`;
    const payload = buildSearchQuery(q, type, pageIdx, perPage, sort);
    const data = await fetchFromAniList(payload);
    const media = data.Page.media || [];
    renderResults(media);
    const pi = data.Page.pageInfo;
    pageInfo.textContent = `Page ${pi.currentPage} / ${pi.lastPage || 1}`;
    prevBtn.disabled = pi.currentPage <= 1;
    nextBtn.disabled = pi.currentPage >= (pi.lastPage || 1);
  } catch (err) {
    resultsEl.innerHTML = `<p style="color:#ffb4b4; grid-column:1/-1; text-align:center">Error: ${err.message}</p>`;
    console.error(err);
  }
}

// Open modal with media details
async function openModal(id) {
  let item = lastResults.find(m => String(m.id) === String(id));
  if (!item) {
    // fetch single media
    const q = {
      query: `
        query ($id: Int) {
          Media(id: $id) {
            id
            title { romaji english native }
            coverImage { large medium }
            bannerImage
            genres
            averageScore
            description(asHtml: false)
            chapters episodes volumes
            startDate { year month day }
            status format siteUrl favourites popularity
          }
        }
      `,
      variables: { id: Number(id) }
    };
    try {
      const data = await fetchFromAniList(q);
      item = data.Media;
    } catch (e) {
      console.error(e);
      alert('Failed to load details');
      return;
    }
  }

  // Fill modal
  modalTitle.textContent = item.title.romaji || item.title.english || item.title.native || 'Untitled';

  const desc = item.description
    ? item.description.replace(/<\/?[^>]+(>|$)/g, '') // strip HTML tags
    : 'No description available';

  modalBody.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap; align-items:flex-start">
      <img src="${item.coverImage?.large || item.coverImage?.medium || ''}" alt=""
        style="width:180px;border-radius:8px;flex:0 0 180px" />
      <div style="flex:1;min-width:200px">
        <p style="color:var(--muted); line-height:1.4;">${desc}</p>
        <ul style="color:var(--muted); margin-top:12px; padding-left:16px; line-height:1.5;">
          <li><strong>Format:</strong> ${item.format || '—'}</li>
          <li><strong>Status:</strong> ${item.status || '—'}</li>
          <li><strong>Score:</strong> ${item.averageScore ?? '—'}</li>
          <li><strong>Episodes / Chapters:</strong> ${item.episodes ?? item.chapters ?? '—'}</li>
          <li><strong>Genres:</strong> ${(item.genres || []).join(', ') || '—'}</li>
          <li><a href="${item.siteUrl || '#'}" target="_blank" rel="noopener">View on AniList</a></li>
        </ul>
      </div>
    </div>
  `;

  modal.setAttribute('aria-hidden', 'false');

  // Preselect status for saving
  const saved = loadMyList()[String(item.id)];
  statusSelect.value = saved?.status || '';

  modal.dataset.currentId = item.id;
}

// Close modal
function closeDetails() {
  modal.setAttribute('aria-hidden', 'true');
  delete modal.dataset.currentId;
}

// Save status from modal into list
saveStatusBtn.addEventListener('click', () => {
  const id = modal.dataset.currentId;
  if (!id) return;
  const status = statusSelect.value;
  if (!status) {
    alert('Please choose a status to save.');
    return;
  }

  const item = lastResults.find(m => String(m.id) === String(id));
  const title = item
    ? (item.title.romaji || item.title.english || item.title.native)
    : modalTitle.textContent;

  const list = loadMyList();
  list[String(id)] = {
    id: Number(id),
    title,
    status,
    custom: false,
    savedAt: Date.now()
  };
  saveMyList(list);
  closeDetails();
});

// Modal closing events
closeModal.addEventListener('click', closeDetails);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeDetails();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
    closeDetails();
  }
});

// Custom-entry modal open/close
function openCustomModal() {
  customModal.setAttribute('aria-hidden', 'false');
}

function closeCustom() {
  customModal.setAttribute('aria-hidden', 'true');
}

customEntryBtn.addEventListener('click', openCustomModal);
closeCustomModal.addEventListener('click', closeCustom);

customModal.addEventListener('click', (e) => {
  if (e.target === customModal) closeCustom();
});

// Save custom/private entry
saveCustomEntry.addEventListener('click', () => {
  const title = customTitle.value.trim();
  if (!title) {
    alert('Title is required.');
    return;
  }

  const entry = {
    id: 'custom_' + Date.now(),
    title,
    type: customType.value,
    img: customImg.value.trim() || null,
    status: customStatus.value,
    notes: customNotes.value.trim() || '',
    custom: true,
    savedAt: Date.now()
  };

  const list = loadMyList();
  list[entry.id] = entry;
  saveMyList(list);

  // Clear form
  customTitle.value = '';
  customImg.value = '';
  customNotes.value = '';
  customStatus.value = 'CURRENT';
  customType.value = 'ANIME';

  closeCustom();
});

// My List — localStorage helpers
function loadMyList() {
  try {
    return JSON.parse(localStorage.getItem('trackr_mylist') || '{}');
  } catch (e) {
    return {};
  }
}

function saveMyList(obj) {
  localStorage.setItem('trackr_mylist', JSON.stringify(obj));
  renderMyList();
}

// Render My List (both API and custom)
function renderMyList() {
  const list = loadMyList();
  myListEl.innerHTML = '';

  const entries = Object.entries(list);
  if (entries.length === 0) {
    myListEl.innerHTML = `<li style="color: var(--muted)">No items yet — add from search or create custom entries.</li>`;
    return;
  }

  entries.forEach(([id, meta]) => {
    const li = document.createElement('li');
    const title = meta.title;
    const status = meta.status;

    li.innerHTML = `
      <strong style="color:#fff">${title}</strong>
      <span style="color: var(--muted)"> — ${status}</span>
      ${meta.custom ? ` <em style="color: var(--accent)">(Private)</em>` : ''}
    `;

    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.title = 'Remove';
    rm.style.marginLeft = '8px';
    rm.style.background = 'transparent';
    rm.style.border = 'none';
    rm.style.cursor = 'pointer';
    rm.style.color = 'var(--muted)';
    rm.addEventListener('click', () => {
      const m = loadMyList();
      delete m[id];
      saveMyList(m);
    });

    li.appendChild(rm);
    myListEl.appendChild(li);
  });
}

// Pagination
prevBtn.addEventListener('click', () => {
  if (page > 1) {
    page--;
    runSearch();
  }
});
nextBtn.addEventListener('click', () => {
  page++;
  runSearch();
});

// Search logic
async function runSearch() {
  const q = lastQuery;
  await performSearch(q, lastType, page, lastSort);
}

searchBtn.addEventListener('click', () => {
  page = 1;
  lastQuery = searchInput.value.trim();
  lastType = mediaTypeSelect.value;
  lastSort = sortSelect.value;
  runSearch();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchBtn.click();
});

const debounced = debounce(() => {
  page = 1;
  lastQuery = searchInput.value.trim();
  lastType = mediaTypeSelect.value;
  lastSort = sortSelect.value;
  if (lastQuery.length >= 2) runSearch();
}, 550);

searchInput.addEventListener('input', debounced);

// Initialize
renderMyList();
pageInfo.textContent = 'Page 1';
