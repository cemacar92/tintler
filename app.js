// Google Apps Script Deploy URL'nizi buraya yapıştırın
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxCWYD5URL6w8q08NAr2fq6t87QtABPMmJFVJ4EA_U/dev";

const i18n = {
  en: { nav_home: "Home", nav_games: "Games", nav_anime: "Anime", nav_manga: "Manga", nav_movies_tv: "Movies & TV", nav_books: "Books", login: "Login", home_welcome: "My Media Collection", columns: "Columns", import: "Import Data" },
  tr: { nav_home: "Anasayfa", nav_games: "Oyunlar", nav_anime: "Animeler", nav_manga: "Mangalar", nav_movies_tv: "Film/Dizi", nav_books: "Kitaplar", login: "Giriş Yap", home_welcome: "Medya Kütüphanem", columns: "Sütunlar", import: "Veri Aktar" }
};

let activeTab = "home";
let currentData = [];

function switchTab(tabName) {
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
  container.innerHTML = "<p>Yükleniyor...</p>";

  try {
    const res = await fetch(`${GAS_API_URL}?action=get_data&tab=${tab}`);
    const json = await res.json();
    if (json.success) {
      currentData = json.data;
      renderData(currentData);
    }
  } catch (err) {
    container.innerHTML = "<p>Veri yüklenirken hata oluştu. Lütfen Apps Script URL'sini kontrol edin.</p>";
  }
}

function renderData(data) {
  const container = document.getElementById('mediaContainer');
  container.innerHTML = "";

  data.forEach(item => {
    const div = document.createElement('div');
    div.className = "media-item";
    const cover = item.Cover_URL || "https://via.placeholder.com/150x220?text=No+Cover";
    const title = item.Title || item.series_title || "Untitled";

    div.innerHTML = `
      <img src="${cover}" alt="${title}">
      <div class="media-info">
        <strong>${title}</strong>
        ${item.Score || item.My_Score ? `<p>⭐ ${item.Score || item.My_Score}</p>` : ''}
      </div>
    `;
    container.appendChild(div);
  });
}

function changeLanguage(lang) {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (i18n[lang][key]) el.innerText = i18n[lang][key];
  });
}

function changeViewMode(mode) {
  const container = document.getElementById('mediaContainer');
  container.className = `view-${mode}`;
}