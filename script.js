// ---------------------------------------------------------------
// Tab configuration — edit here if your CSV column names change
// ---------------------------------------------------------------
const CONFIG = {
  games: {
    source: 'data/games.csv',
    accent: '#8b7cf6',
    titleCol: 'Game name',
    defaultCols: ['Game name', 'Platform', 'Status', 'Completion', 'Rating (Score)', 'Playtime', 'Completion date'],
    filterCols: ['Status', 'Platform', 'Type'],
    numericCols: ['Playtime', 'Times completed', 'Rating (Score)', 'Rating (Gameplay)', 'Rating (Sound)', 'Rating (Story)', 'Rating (Visual)', 'Rating (Accessibility)', 'Amount paid', 'Additional Cost'],
  },
  anime: {
    source: 'data/anime.csv',
    accent: '#f2597e',
    titleCol: 'Title',
    defaultCols: ['Title', 'Type', 'Season', 'Total Episodes', 'Watched Episodes', 'Status', 'Score'],
    filterCols: ['Status', 'Type'],
    numericCols: ['Total Episodes', 'Watched Episodes', 'Score', 'Times Watched'],
  },
  movies: {
    source: 'data/movies.csv',
    accent: '#45d3c4',
    titleCol: 'Title',
    defaultCols: ['Title', 'Title Type', 'Year', 'Genres', 'IMDb Rating', 'Your Rating', 'Sezon', 'Bölüm'],
    filterCols: ['Title Type'],
    numericCols: ['IMDb Rating', 'Runtime (mins)', 'Year', 'Num Votes', 'Your Rating'],
  },
};

const state = {}; // per-tab: { rows, columns, visible:Set, filters:{}, search:'', sort:{col,dir} }
let activeTab = 'games';

// ---------------------------------------------------------------
// Storage helpers (per-tab column visibility persisted locally)
// ---------------------------------------------------------------
function loadVisible(tab, allCols) {
  try {
    const saved = localStorage.getItem('cols:' + tab);
    if (saved) {
      const arr = JSON.parse(saved).filter(c => allCols.includes(c));
      if (arr.length) return new Set(arr);
    }
  } catch (e) {}
  return new Set(CONFIG[tab].defaultCols.filter(c => allCols.includes(c)));
}
function saveVisible(tab) {
  localStorage.setItem('cols:' + tab, JSON.stringify([...state[tab].visible]));
}

// ---------------------------------------------------------------
// Boot: parse each CSV, build the UI shell for each panel
// ---------------------------------------------------------------
Object.keys(CONFIG).forEach(tab => {
  Papa.parse(CONFIG[tab].source, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      const rows = res.data;
      const columns = res.meta.fields || [];
      state[tab] = {
        rows,
        columns,
        visible: loadVisible(tab, columns),
        filters: {},
        search: '',
        sort: { col: null, dir: 1 },
      };
      buildPanel(tab);
      document.getElementById('count-' + tab).textContent = rows.length;
    },
    error: (err) => {
      document.getElementById('panel-' + tab).innerHTML =
        `<div class="empty-state">Veri yüklenemedi: ${CONFIG[tab].source}<br>(Bu dosyanın index.html ile aynı klasör yapısında, bir web sunucusu üzerinden açıldığından emin ol — dosyayı doğrudan çift tıklayarak açmak fetch() işlemini engeller.)</div>`;
    }
  });
});

// ---------------------------------------------------------------
// Build a tab panel: toolbar (search/filters/customize) + table
// ---------------------------------------------------------------
function buildPanel(tab) {
  const panel = document.getElementById('panel-' + tab);
  const cfg = CONFIG[tab];

  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';

  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'search-input';
  search.placeholder = 'Ara...';
  search.addEventListener('input', () => {
    state[tab].search = search.value.toLowerCase();
    renderTable(tab);
  });
  toolbar.appendChild(search);

  cfg.filterCols.forEach(col => {
    if (!state[tab].columns.includes(col)) return;
    const values = [...new Set(state[tab].rows.map(r => (r[col] || '').trim()).filter(Boolean))].sort();
    if (!values.length) return;
    const sel = document.createElement('select');
    sel.className = 'filter-select';
    sel.innerHTML = `<option value="">${col}: Tümü</option>` +
      values.map(v => `<option value="${escapeAttr(v)}">${escapeHtml(v)}</option>`).join('');
    sel.addEventListener('change', () => {
      state[tab].filters[col] = sel.value;
      renderTable(tab);
    });
    toolbar.appendChild(sel);
  });

  const colBtn = document.createElement('button');
  colBtn.className = 'btn';
  colBtn.textContent = '⚙ Sütunlar';
  colBtn.addEventListener('click', () => openColumnModal(tab));
  toolbar.appendChild(colBtn);

  panel.appendChild(toolbar);

  const meta = document.createElement('div');
  meta.className = 'result-meta';
  meta.id = 'meta-' + tab;
  panel.appendChild(meta);

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  wrap.id = 'tablewrap-' + tab;
  panel.appendChild(wrap);

  renderTable(tab);
}

// ---------------------------------------------------------------
// Filtering + sorting + rendering the table body
// ---------------------------------------------------------------
function getFilteredRows(tab) {
  const s = state[tab];
  const cfg = CONFIG[tab];
  let rows = s.rows.filter(row => {
    if (s.search) {
      const hay = s.columns.map(c => row[c] || '').join(' ').toLowerCase();
      if (!hay.includes(s.search)) return false;
    }
    for (const col in s.filters) {
      const val = s.filters[col];
      if (val && (row[col] || '').trim() !== val) return false;
    }
    return true;
  });

  if (s.sort.col) {
    const col = s.sort.col;
    const numeric = cfg.numericCols.includes(col);
    rows = rows.slice().sort((a, b) => {
      let av = (a[col] || '').trim();
      let bv = (b[col] || '').trim();
      if (numeric) {
        av = parseFloat(av) || -Infinity;
        bv = parseFloat(bv) || -Infinity;
        return (av - bv) * s.sort.dir;
      }
      return av.localeCompare(bv, 'tr') * s.sort.dir;
    });
  }
  return rows;
}

function renderTable(tab) {
  const s = state[tab];
  const cfg = CONFIG[tab];
  const cols = s.columns.filter(c => s.visible.has(c));
  const rows = getFilteredRows(tab);
  const wrap = document.getElementById('tablewrap-' + tab);
  document.getElementById('meta-' + tab).innerHTML = `<b>${rows.length}</b> / ${s.rows.length} kayıt`;

  if (!cols.length) {
    wrap.innerHTML = `<div class="empty-state">Gösterilecek sütun seçilmedi. "⚙ Sütunlar" ile en az bir sütun aç.</div>`;
    return;
  }
  if (!rows.length) {
    wrap.innerHTML = `<div class="empty-state">Bu filtrelerle eşleşen kayıt yok.</div>`;
    return;
  }

  let html = '<table><thead><tr>';
  cols.forEach(c => {
    let arrow = '';
    if (s.sort.col === c) arrow = `<span class="arrow">${s.sort.dir === 1 ? '▲' : '▼'}</span>`;
    html += `<th data-col="${escapeAttr(c)}">${escapeHtml(c)}${arrow}</th>`;
  });
  html += '</tr></thead><tbody>';

  rows.forEach(row => {
    html += '<tr>';
    cols.forEach(c => {
      const val = (row[c] || '').trim();
      const display = val === '' ? '—' : escapeHtml(val);
      const cls = c === cfg.titleCol ? 'title-cell' : (cfg.numericCols.includes(c) ? 'num-cell' : '');
      html += `<td class="${cls}" title="${escapeAttr(val)}">${display}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  wrap.querySelectorAll('th').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (s.sort.col === col) s.sort.dir *= -1;
      else { s.sort.col = col; s.sort.dir = 1; }
      renderTable(tab);
    });
  });
}

// ---------------------------------------------------------------
// Column customize modal
// ---------------------------------------------------------------
const modalBackdrop = document.getElementById('colModalBackdrop');
const colList = document.getElementById('colList');
let modalTab = null;

function openColumnModal(tab) {
  modalTab = tab;
  const s = state[tab];
  colList.innerHTML = s.columns.map(c => `
    <label class="col-item">
      <input type="checkbox" data-col="${escapeAttr(c)}" ${s.visible.has(c) ? 'checked' : ''}>
      <span>${escapeHtml(c)}</span>
    </label>
  `).join('');
  colList.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', () => {
      const col = inp.dataset.col;
      if (inp.checked) s.visible.add(col); else s.visible.delete(col);
      saveVisible(tab);
      renderTable(tab);
    });
  });
  modalBackdrop.classList.add('open');
}
document.getElementById('colModalClose').addEventListener('click', () => modalBackdrop.classList.remove('open'));
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) modalBackdrop.classList.remove('open'); });
document.getElementById('colSelectAll').addEventListener('click', () => {
  if (!modalTab) return;
  state[modalTab].columns.forEach(c => state[modalTab].visible.add(c));
  saveVisible(modalTab);
  openColumnModal(modalTab);
  renderTable(modalTab);
});
document.getElementById('colSelectNone').addEventListener('click', () => {
  if (!modalTab) return;
  state[modalTab].visible.clear();
  saveVisible(modalTab);
  openColumnModal(modalTab);
  renderTable(modalTab);
});

// ---------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
    document.documentElement.style.setProperty('--accent', CONFIG[tab].accent);
  });
});

// ---------------------------------------------------------------
// Utils
// ---------------------------------------------------------------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
function escapeAttr(str) { return escapeHtml(str); }
