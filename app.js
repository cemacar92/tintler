// Google Apps Script Deploy URL'nizi buraya yapıştırın (/exec ile bitmelidir!)
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwY5enhlw-WYmZGqyx7feOjQFas-JDsjWB_XOJOuKzAjVAfcF4pxm8uvJFJ47nFy_vi/exec";

const i18n = {
  en: { nav_home: "Home", nav_games: "Games", nav_anime: "Anime", nav_manga: "Manga", nav_movies_tv: "Movies & TV", nav_books: "Books", login: "Login", home_welcome: "My Media Collection", columns: "Columns", import: "Import Data" },
  tr: { nav_home: "Anasayfa", nav_games: "Oyunlar", nav_anime: "Animeler", nav_manga: "Mangalar", nav_movies_tv: "Film/Dizi", nav_books: "Kitaplar", login: "Giriş Yap", home_welcome: "Medya Kütüphanem", columns: "Sütunlar", import: "Veri Aktar" }
};

let activeTab = "home";
let currentData = [];
let headersList = [];
let hiddenColumns = new Set();
let adminPassword = "";

function showTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');

  if (tabName === 'home') {
    document.getElementById('tab-home').style.display = 'block';
  } else {
    document.getElementById('tab-data-view').style.display = 'block';
    loadTabData(tabName);
  }
}

async function loadTabData(tab) {
  const container = document.getElementById('mediaContainer');
  container.innerHTML = "<p style='grid-column: 1/-1;'>Yükleniyor...</p>";

  try {
    const res = await fetch(`${GAS_API_URL}?action=get_data&tab=${tab}`);
    const json = await res.json();
    if (json.success) {
      currentData = json.data || [];
      headersList = json.headers || [];
      buildColumnSelector();
      renderData(currentData);
    } else {
      container.innerHTML = `<p style='grid-column: 1/-1;'>Hata: ${json.error}</p>`;
    }
  } catch (err) {
    container.innerHTML = "<p style='grid-column: 1/-1;'>Veri yüklenirken hata oluştu. Apps Script URL veya bağlantıyı kontrol edin.</p>";
  }
}

function renderData(data) {
  const container = document.getElementById('mediaContainer');
  const viewMode = document.getElementById('viewSelect').value;
  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = "<p style='grid-column: 1/-1;'>Gösterilecek veri yok.</p>";
    return;
  }

  data.forEach(item => {
    const title = item.Title || item.series_title || item.name || "Untitled";
    const cover = item.Cover_URL || item.cover || "https://via.placeholder.com/150x220?text=No+Cover";
    const score = item.Score || item.My_Score || item.my_score || "";

    if (viewMode === "list") {
      const row = document.createElement('div');
      row.className = "list-row";
      
      let extraInfo = [];
      headersList.forEach(h => {
        if (!hiddenColumns.has(h) && item[h] !== undefined && item[h] !== "") {
          extraInfo.push(`<b>${h}:</b> ${item[h]}`);
        }
      });

      row.innerHTML = `
        <div><strong>${title}</strong></div>
        <div>${extraInfo.join(" | ")}</div>
      `;
      container.appendChild(row);

    } else {
      const div = document.createElement('div');
      div.className = "media-item";

      let titleHtml = viewMode === "grid-title" ? `<div class="media-info"><strong>${title}</strong> ${score ? `<p>⭐ ${score}</p>` : ''}</div>` : '';

      div.innerHTML = `
        <img src="${cover}" alt="${title}" onerror="this.src='https://via.placeholder.com/150x220?text=No+Cover'">
        ${titleHtml}
      `;
      container.appendChild(div);
    }
  });
}

function filterData() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const filtered = currentData.filter(item => {
    return Object.values(item).some(val => String(val).toLowerCase().includes(query));
  });
  renderData(filtered);
}

function buildColumnSelector() {
  const selector = document.getElementById('columnSelector');
  selector.innerHTML = "";
  headersList.forEach(header => {
    const label = document.createElement('label');
    label.innerHTML = `
      <input type="checkbox" checked onchange="toggleColumn('${header}', this.checked)"> ${header}
    `;
    selector.appendChild(label);
  });
}

function toggleColumn(header, isChecked) {
  if (isChecked) {
    hiddenColumns.delete(header);
  } else {
    hiddenColumns.add(header);
  }
  renderData(currentData);
}

function changeLanguage(lang) {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (i18n[lang] && i18n[lang][key]) el.innerText = i18n[lang][key];
  });
}

function changeViewMode(mode) {
  const container = document.getElementById('mediaContainer');
  container.className = `view-${mode}`;
  renderData(currentData);
}

/* Login Modal & Admin Controls */
function openLoginModal() {
  document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
  document.getElementById('loginModal').style.display = 'none';
}

function submitLogin() {
  adminPassword = document.getElementById('adminPassword').value;
  if (adminPassword) {
    document.getElementById('adminControls').style.display = 'block';
    document.getElementById('loginBtn').innerText = "Admin ✅";
    closeLoginModal();
  }
}

/* Dynamic CSV / XML Parsing & Import */
function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file || !adminPassword) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    const content = e.target.result;
    let items = [];

    if (file.name.endsWith('.xml')) {
      items = parseXML(content);
    } else if (file.name.endsWith('.csv')) {
      items = parseCSV(content);
    }

    if (items.length === 0) {
      alert("Dosya okunamadı veya boş.");
      return;
    }

    // Apps Script'e Gönder
    const payload = {
      action: "import_data",
      password: adminPassword,
      tab: activeTab,
      idKey: activeTab === 'anime' ? 'series_animedb_id' : 'Title',
      items: items
    };

    try {
      const res = await fetch(GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        alert("Veriler başarıyla aktarıldı!");
        loadTabData(activeTab);
      } else {
        alert("Hata: " + json.error);
      }
    } catch (err) {
      alert("Sunucuya erişilirken hata oluştu.");
    }
  };

  reader.readAsText(file);
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    let obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || "");
    return obj;
  });
}

function parseXML(text) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  const animeNodes = xmlDoc.getElementsByTagName("anime");
  let items = [];

  for (let i = 0; i < animeNodes.length; i++) {
    let obj = {};
    let children = animeNodes[i].childNodes;
    for (let j = 0; j < children.length; j++) {
      if (children[j].nodeType === 1) {
        obj[children[j].nodeName] = children[j].textContent;
      }
    }
    items.push(obj);
  }
  return items;
}
