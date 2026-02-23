// =============================================
//  RIGA PET MAP — App Logic
// =============================================
//  Sections:
//  1. Telegram Mini App Init
//  2. Localization
//  3. Config & Constants
//  4. Map Initialization
//  5. CSV Data Loading & Markers
//  6. Bottom Sheet UI
//  7. Location Pick Mode
//  8. Submit New Place
//  9. Filtering
//  10. Locate User (Geolocation)
//  11. Report Issue (Deep Link)
// =============================================


// 1. Telegram Mini App Init
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.expand();
    if (window.Telegram.WebApp.isVersionAtLeast('7.7')) {
        window.Telegram.WebApp.disableVerticalSwipes();
    }
    window.Telegram.WebApp.ready();
}


// 2. Localization
const translations = {
    'en': {
        all: 'All', cafe: 'Cafe', restaurant: 'Restaurant', park: 'Park', mall: 'Shopping Mall', vet: 'Vet Clinic',
        gethere: 'Get directions', report: 'Report an issue', youarehere: 'You are here!', workinghours: 'Working hours',
        addtitle: 'Add New Place', addsubtitle: 'First choose exact location on map, then fill details',
        lblname: 'Name', lblcat: 'Category', lblcom: 'Comment', btnsubmit: 'Submit Place',
        success: 'Place submitted for moderation!',
        lbllocation: 'Location', picklocation: 'Choose on map',
        coordschosen: 'Selected: {lat}, {lon}', chooselocationfirst: 'Please choose location on map first'
    },
    'ru': {
        all: 'Все', cafe: 'Кафе', restaurant: 'Ресторан', park: 'Парк', mall: 'ТЦ', vet: 'Ветклиника',
        gethere: 'Проложить маршрут', report: 'Сообщить об ошибке', youarehere: 'Вы здесь!', workinghours: 'Время работы',
        addtitle: 'Добавить место', addsubtitle: 'Сначала выберите точное место на карте, затем заполните поля',
        lblname: 'Название', lblcat: 'Категория', lblcom: 'Комментарий', btnsubmit: 'Отправить',
        success: 'Место отправлено на модерацию!',
        lbllocation: 'Локация', picklocation: 'Выбрать на карте',
        coordschosen: 'Выбрано: {lat}, {lon}', chooselocationfirst: 'Сначала выберите локацию на карте'
    },
    'lv': {
        all: 'Visi', cafe: 'Kafejnīca', restaurant: 'Restorāns', park: 'Parks', mall: 'Tirdzniecības centrs', vet: 'Vetklīnika',
        gethere: 'Maršruts', report: 'Ziņot par kļūdu', youarehere: 'Jūs esat šeit!', workinghours: 'Darba laiks',
        addtitle: 'Pievienot vietu', addsubtitle: 'Vispirms izvēlieties vietu kartē, pēc tam aizpildiet datus',
        lblname: 'Nosaukums', lblcat: 'Kategorija', lblcom: 'Komentārs', btnsubmit: 'Iesniegt',
        success: 'Vieta nosūtīta pārbaudei!',
        lbllocation: 'Atrašanās vieta', picklocation: 'Izvēlēties kartē',
        coordschosen: 'Izvēlēts: {lat}, {lon}', chooselocationfirst: 'Lūdzu, vispirms izvēlieties vietu kartē'
    }
};

let userLangCode = 'en';
if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    userLangCode = window.Telegram.WebApp.initDataUnsafe.user.language_code || 'en';
}
const currentLang = (userLangCode.slice(0, 2).toLowerCase() in translations)
    ? userLangCode.slice(0, 2).toLowerCase()
    : 'en';
const t = translations[currentLang];

// Apply translations to static UI
document.getElementById('btn-all').childNodes[0].textContent = t.all;
document.getElementById('btn-cafe').lastChild.textContent = ' ' + t.cafe;
document.getElementById('btn-restaurant').lastChild.textContent = ' ' + t.restaurant;
document.getElementById('btn-park').lastChild.textContent = ' ' + t.park;
document.getElementById('btn-mall').lastChild.textContent = ' ' + t.mall;
document.getElementById('btn-vet').lastChild.textContent = ' ' + t.vet;
document.getElementById('txt-add-title').textContent = t.addtitle;
document.getElementById('txt-add-subtitle').textContent = t.addsubtitle;
document.getElementById('lbl-name').textContent = t.lblname;
document.getElementById('lbl-category').textContent = t.lblcat;
document.getElementById('lbl-comment').textContent = t.lblcom;
document.getElementById('btn-submit').textContent = t.btnsubmit;
document.getElementById('lbl-location').textContent = t.lbllocation;
document.getElementById('txt-pick-location').textContent = t.picklocation;


// 3. Config & Constants
const BACKEND_API_URL = "https://riga-pet-bot.onrender.com/api/add_place"; // Update on Hetzner migration
const BOT_USERNAME    = "RigaDogMap_bot";
const GOOGLE_SHEET_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQwZgrpWxkAs2G_aMBWNpPvYAOLa2WrnyXI2RvvkpK59SsAVkxj46d296AlU_Jet0O8wI9ZRORt1MMN/pub?gid=0&single=true&output=csv";


// 4. Map Initialization
const map = L.map('mapdiv', { zoomControl: false }).setView([56.9496, 24.1052], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
}).addTo(map);


// 5. CSV Data Loading & Markers
let allMarkers = [];

Papa.parse(GOOGLE_SHEET_CSV, {
    download: true,
    header: true,
    complete: function(results) {
        results.data.forEach(function(place) {
            if (!place || Object.keys(place).length === 0 || !place.Lat) return;

            const lat = parseFloat(String(place.Lat).replace(',', '.'));
            const lon = parseFloat(String(place.Lon).replace(',', '.'));
            if (isNaN(lat) || isNaN(lon)) {
                console.warn("Skipped invalid coordinates for:", place.Name);
                return;
            }

            const placeCategory = place['Category_' + currentLang.toUpperCase()] || place['Category_EN'] || place['Category'];
            const placeComment  = place['Comment_'  + currentLang.toUpperCase()] || place['Comment_EN']  || place['Comment'];
            const workHours     = place['WorkHours_' + currentLang.toUpperCase()] || place['WorkHours_EN'] || place['WorkHours'];
            const techCategory  = (place['Category_EN'] || place['Category'] || "").toLowerCase();

            const colorMap = {
                park: '#28a745', vet: '#dc3545',
                cafe: '#007bff', restaurant: '#ffde73',
                shop: '#fd7e14', mall: '#fd7e14'
            };
            let pointColor = '#3388ff';
            for (const [key, color] of Object.entries(colorMap)) {
                if (techCategory.includes(key)) { pointColor = color; break; }
            }

            const marker = L.circleMarker([lat, lon], {
                radius: 9, fillColor: pointColor, color: '#fff',
                weight: 2, opacity: 1, fillOpacity: 0.9
            }).addTo(map);

            allMarkers.push({ layer: marker, category: techCategory });

            marker.on('click', function() {
                openPlaceSheet(place, placeCategory, placeComment, workHours, lat, lon);
                map.flyTo([lat - 0.005, lon], 14, { animate: true, duration: 0.5 });
                if (typeof gtag === 'function') {
                    gtag('event', 'click_place_pin', { place_name: place['Name'], place_category: techCategory });
                }
            });
        });
    },
    error: function(err) { console.error("Error loading CSV:", err); }
});


// 6. Bottom Sheet UI
function closeAllSheets() {
    document.getElementById('sheetOverlay').classList.remove('active');
    document.getElementById('placeSheet').classList.remove('active');
    document.getElementById('addPlaceSheet').classList.remove('active');
    document.getElementById('crosshair').style.display = 'none';
    document.getElementById('btn-confirm-location').style.display = 'none';
    isPickingLocation = false;
    document.querySelector('.filter-container').style.display = 'flex';
    document.getElementById('btn-locate').style.display = 'flex';
    document.getElementById('btn-add').style.display = 'flex';
}

function openPlaceSheet(place, category, comment, hours, lat, lon) {
    const escapedName = (place['Name'] || "").replace(/'/g, "\\'");
    let html = '';

    if (place['Photo URL']) {
        // img onload: detect logo vs photo by aspect ratio
        // Logos are typically square or tall (ratio <= 2.5), photos are wide
        // Logo SVG and PNG with transparency also detected this way
        html += `
            <div class="sheet-img-wrap" id="img-wrap-${escapedName.replace(/\s/g,'')}">
                <img src="${place['Photo URL']}"
                     class="sheet-img"
                     alt="${place['Name']}"
                     onload="detectImgType(this)"
                     onerror="this.closest('.sheet-img-wrap').style.display='none'">
            </div>`;
    }

    html += `<h3 class="sheet-title">${place['Name']}</h3>`;
    html += `<span class="sheet-category">${category}</span>`;
    if (hours)   html += `<div class="sheet-hours"><span>${t.workinghours}:</span>${hours}</div>`;
    if (comment) html += `<div class="sheet-comment">${comment}</div>`;
    html += `
        <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}"
           target="_blank" class="btn-primary"
           onclick="if(typeof gtag==='function') gtag('event','click_route',{place_name:'${escapedName}'});">
           ${t.gethere}
        </a>
        <div class="btn-report" onclick="handleReportClick(event,'${BOT_USERNAME}','${escapedName}')">
           ${t.report}
        </div>
    `;

    document.getElementById('placeSheetContent').innerHTML = html;
    document.getElementById('sheetOverlay').classList.add('active');
    document.getElementById('placeSheet').classList.add('active');
    document.getElementById('addPlaceSheet').classList.remove('active');
}

// Called via onload — switches wrap to logo-mode if image looks like a logo
function detectImgType(imgEl) {
    const wrap = imgEl.closest('.sheet-img-wrap');
    if (!wrap) return;
    const ratio = imgEl.naturalWidth / imgEl.naturalHeight;
    // If image is square, tall, or only slightly wide — treat as logo
    if (ratio < 2.5) {
        wrap.classList.add('logo-mode');
    }
}


function openAddPlaceSheet() {
    closeAllSheets();
    document.getElementById('sheetOverlay').classList.add('active');
    document.getElementById('addPlaceSheet').classList.add('active');
}


// 7. Location Pick Mode
let pickedLat = null;
let pickedLon = null;
let isPickingLocation = false;
const confirmBtn = document.getElementById('btn-confirm-location');

function startLocationPick() {
    document.getElementById('addPlaceSheet').classList.remove('active');
    document.getElementById('sheetOverlay').classList.remove('active');
    isPickingLocation = true;
    document.getElementById('crosshair').style.display = 'block';
    document.querySelector('.filter-container').style.display = 'none';
    document.getElementById('btn-locate').style.display = 'none';
    document.getElementById('btn-add').style.display = 'none';
    confirmBtn.style.display = 'block';
}

function confirmLocationPick() {
    if (!isPickingLocation) return;
    const center = map.getCenter();
    pickedLat = center.lat;
    pickedLon = center.lng;
    isPickingLocation = false;
    document.getElementById('crosshair').style.display = 'none';
    confirmBtn.style.display = 'none';
    document.querySelector('.filter-container').style.display = 'flex';
    document.getElementById('btn-locate').style.display = 'flex';
    document.getElementById('btn-add').style.display = 'flex';
    document.getElementById('sheetOverlay').classList.add('active');
    document.getElementById('addPlaceSheet').classList.add('active');
    const coordsText = t.coordschosen
        .replace('{lat}', pickedLat.toFixed(5))
        .replace('{lon}', pickedLon.toFixed(5));
    document.getElementById('coords-label').textContent = coordsText;
    document.getElementById('chosen-coords').style.display = 'block';
}

confirmBtn.addEventListener('click', confirmLocationPick);


// 8. Submit New Place
async function submitNewPlace() {
    const name     = document.getElementById('add-name').value.trim();
    const category = document.getElementById('add-category').value;
    const comment  = document.getElementById('add-comment').value.trim();

    if (pickedLat === null || pickedLon === null) { alert(t.chooselocationfirst); return; }
    if (!name) { alert(currentLang === 'ru' ? 'Введите название' : 'Please enter a name'); return; }

    const payload = {
        name, category, comment,
        lat: pickedLat, lon: pickedLon,
        user_id:  window.Telegram?.WebApp?.initDataUnsafe?.user?.id      || 0,
        username: window.Telegram?.WebApp?.initDataUnsafe?.user?.username || 'anonymous'
    };

    const submitBtn = document.getElementById('btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = currentLang === 'ru' ? '⏳ Отправка...' : currentLang === 'lv' ? '⏳ Sūta...' : '⏳ Sending...';

    try {
        const response = await fetch(BACKEND_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        // Show success state on button briefly before closing
        submitBtn.textContent = '✅';
        await new Promise(resolve => setTimeout(resolve, 800));

        alert(t.success);
        closeAllSheets();
        document.getElementById('add-name').value = '';
        document.getElementById('add-comment').value = '';
        document.getElementById('chosen-coords').style.display = 'none';
        pickedLat = null;
        pickedLon = null;
    } catch (err) {
        console.error("API error:", err);
        alert("Error sending request. Please check backend connection.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = t.btnsubmit;
    }
}



// 9. Filtering
let currentFilters = ['all'];

function filterMap(category, btnElement) {
    if (category === 'all') {
        currentFilters = ['all'];
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    } else {
        if (currentFilters.includes('all')) {
            currentFilters = [];
            document.querySelector('.filter-btn').classList.remove('active');
        }
        if (currentFilters.includes(category)) {
            currentFilters = currentFilters.filter(c => c !== category);
            btnElement.classList.remove('active');
        } else {
            currentFilters.push(category);
            btnElement.classList.add('active');
        }
        if (currentFilters.length === 0) {
            currentFilters = ['all'];
            document.getElementById('btn-all').classList.add('active');
        }
    }
    allMarkers.forEach(function(item) {
        const visible = currentFilters.includes('all') || currentFilters.some(f => item.category.includes(f));
        if (visible  && !map.hasLayer(item.layer)) map.addLayer(item.layer);
        if (!visible &&  map.hasLayer(item.layer)) map.removeLayer(item.layer);
    });
}


// 10. Locate User (Geolocation)
let userMarker = null;

function findUserLocation() {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.circleMarker([lat, lon], {
                radius: 8, fillColor: '#007aff', color: '#fff',
                weight: 3, opacity: 1, fillOpacity: 1
            }).addTo(map);
            map.flyTo([lat, lon], 15, { animate: true, duration: 1.5 });
        },
        function() { alert("Unable to retrieve location"); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}


// 11. Report Issue (Deep Link)
function getSafeTelegramLink(botName, placeName) {
    try {
        const encoded = btoa(unescape(encodeURIComponent(placeName)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        return `https://t.me/${botName}?start=error_${encoded}`;
    } catch (e) {
        console.error("Link encoding error:", e);
        return `https://t.me/${botName}`;
    }
}

function handleReportClick(event, botName, placeName) {
    event.preventDefault();
    const link = getSafeTelegramLink(botName, placeName);
    if (window.Telegram?.WebApp?.initData) {
        window.Telegram.WebApp.openTelegramLink(link);
        window.Telegram.WebApp.close();
    } else {
        window.open(link, '_blank');
    }
}
