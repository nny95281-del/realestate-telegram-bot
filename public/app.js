/**
 * Real Estate Geotagging Mini App Frontend Logic
 * Leaflet.js Map + Telegram WebApp SDK Integration
 */

// Initialize Telegram WebApp if present
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
  if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');
}

// Global App State
const state = {
  properties: [],
  filteredProperties: [],
  map: null,
  markersLayer: null,
  currentLayerType: 'street', // 'street' or 'satellite'
  streetTileLayer: null,
  satelliteTileLayer: null,
  selectedProperty: null
};

// Tile Layer URLs
const STREET_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// DOM Elements
const elements = {
  mapContainer: document.getElementById('map'),
  propertyCountBadge: document.getElementById('property-count-badge'),
  statTotal: document.getElementById('stat-total'),
  statActiveLayer: document.getElementById('stat-active-layer'),
  propertiesList: document.getElementById('properties-list'),
  drawer: document.getElementById('properties-drawer'),
  drawerHandle: document.getElementById('drawer-handle'),
  btnToggleList: document.getElementById('btn-toggle-list'),
  btnCloseDrawer: document.getElementById('btn-close-drawer'),
  searchInput: document.getElementById('search-input'),
  clearSearch: document.getElementById('clear-search'),
  btnLocateMe: document.getElementById('btn-locate-me'),
  btnLayerSwitch: document.getElementById('btn-layer-switch'),
  btnRefresh: document.getElementById('btn-refresh'),
  // Modal Elements
  detailsModal: document.getElementById('details-modal'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalImage: document.getElementById('modal-image'),
  modalDateTag: document.getElementById('modal-date-tag'),
  modalTitle: document.getElementById('modal-title'),
  modalNotes: document.getElementById('modal-notes'),
  modalCoords: document.getElementById('modal-coords'),
  btnGoogleMaps: document.getElementById('btn-google-maps'),
  btnWaze: document.getElementById('btn-waze'),
  btnAppleMaps: document.getElementById('btn-apple-maps'),
  btnDeleteProperty: document.getElementById('btn-delete-property'),
  toast: document.getElementById('toast')
};

// ----------------------------------------------------
// Toast Notifications
// ----------------------------------------------------
function showToast(message, duration = 2500) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, duration);
}

// Trigger Telegram Haptic Feedback
function triggerHaptic(type = 'impact', style = 'light') {
  if (tg && tg.HapticFeedback) {
    if (type === 'impact') {
      tg.HapticFeedback.impactOccurred(style);
    } else if (type === 'notification') {
      tg.HapticFeedback.notificationOccurred(style);
    }
  }
}

// ----------------------------------------------------
// Map Initialization
// ----------------------------------------------------
function initMap() {
  // Default center: Phnom Penh (11.5564, 104.9282)
  state.map = L.map('map', {
    center: [11.5564, 104.9282],
    zoom: 13,
    zoomControl: false // Cleaner UI without default zoom controls
  });

  // Street Layer
  state.streetTileLayer = L.tileLayer(STREET_TILES, {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  });

  // Satellite Layer
  state.satelliteTileLayer = L.tileLayer(SATELLITE_TILES, {
    attribution: '&copy; Esri World Imagery',
    maxZoom: 19
  });

  // Default to Street
  state.streetTileLayer.addTo(state.map);

  // Layer group for property markers
  state.markersLayer = L.layerGroup().addTo(state.map);
}

// Switch Map Layers (Street <-> Satellite)
function toggleMapLayer() {
  triggerHaptic('impact', 'medium');
  if (state.currentLayerType === 'street') {
    state.map.removeLayer(state.streetTileLayer);
    state.satelliteTileLayer.addTo(state.map);
    state.currentLayerType = 'satellite';
    elements.statActiveLayer.textContent = 'Satellite';
    showToast('🗺️ បានប្តូរទៅទម្រង់រូបភាពផ្កាយរណប (Satellite)');
  } else {
    state.map.removeLayer(state.satelliteTileLayer);
    state.streetTileLayer.addTo(state.map);
    state.currentLayerType = 'street';
    elements.statActiveLayer.textContent = 'Street';
    showToast('🗺️ បានប្តូរទៅទម្រង់ផែនទីផ្លូវ (Street View)');
  }
}

// ----------------------------------------------------
// Custom Leaflet Marker Generator
// ----------------------------------------------------
function createCustomPin(property) {
  const thumbUrl = property.image_url || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=150&q=80';
  
  const customIcon = L.divIcon({
    className: 'custom-map-pin-container',
    html: `
      <div class="custom-map-pin" id="pin-${property.id}">
        <div class="pin-badge">
          <img src="${thumbUrl}" alt="Thumb" onerror="this.src='https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=150&q=80'" />
        </div>
        <div class="pin-arrow"></div>
      </div>
    `,
    iconSize: [46, 54],
    iconAnchor: [23, 54],
    popupAnchor: [0, -50]
  });

  const marker = L.marker([property.latitude, property.longitude], { icon: customIcon });

  // Create popup HTML
  const dateFormatted = new Date(property.created_at).toLocaleDateString('km-KH');
  const popupHtml = `
    <div class="popup-card">
      <div class="popup-img-wrapper">
        <img src="${thumbUrl}" alt="${property.title}" />
      </div>
      <div class="popup-body">
        <div class="popup-title">${escapeHtml(property.title)}</div>
        <div class="popup-date"><i class="fa-regular fa-clock"></i> ${dateFormatted}</div>
        <button class="popup-btn" onclick="window.app.openDetailsModal(${property.id})">
          <i class="fa-solid fa-circle-info"></i> មើលព័ត៌មានលម្អិត
        </button>
      </div>
    </div>
  `;

  marker.bindPopup(popupHtml);
  return marker;
}

// Helper: Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ----------------------------------------------------
// Render Map Markers & Properties List
// ----------------------------------------------------
function renderData() {
  state.markersLayer.clearLayers();
  elements.propertiesList.innerHTML = '';

  const list = state.filteredProperties;
  elements.propertyCountBadge.textContent = `${list.length} ទីតាំង`;
  elements.statTotal.textContent = list.length;

  if (list.length === 0) {
    elements.propertiesList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-folder-open"></i>
        <p>មិនមានអចលនទ្រព្យត្រូវបានរកឃើញទេ</p>
      </div>
    `;
    return;
  }

  const bounds = [];

  list.forEach((prop) => {
    // Add Marker
    const marker = createCustomPin(prop);
    state.markersLayer.addLayer(marker);
    bounds.push([prop.latitude, prop.longitude]);

    // Build List Item Card
    const thumbUrl = prop.image_url || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=150&q=80';
    const dateFormatted = new Date(prop.created_at).toLocaleDateString('km-KH');

    const card = document.createElement('div');
    card.className = 'property-card-item';
    card.innerHTML = `
      <img src="${thumbUrl}" class="prop-thumb" alt="Thumbnail" />
      <div class="prop-info">
        <div class="prop-title">${escapeHtml(prop.title)}</div>
        <div class="prop-notes">${escapeHtml(prop.notes || 'គ្មានកត់ចំណាំ')}</div>
        <div class="prop-meta">
          <span><i class="fa-solid fa-location-crosshairs"></i> ${prop.latitude.toFixed(4)}, ${prop.longitude.toFixed(4)}</span>
          <span>${dateFormatted}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      triggerHaptic('impact', 'light');
      focusOnProperty(prop, marker);
      closeDrawer();
    });

    elements.propertiesList.appendChild(card);
  });

  // Fit map bounds if properties exist and search is empty
  if (bounds.length > 0 && !elements.searchInput.value) {
    state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }
}

// Focus and zoom to specific property on map
function focusOnProperty(property, marker = null) {
  state.map.flyTo([property.latitude, property.longitude], 17, {
    duration: 1.2,
    easeLinearity: 0.25
  });

  if (marker) {
    setTimeout(() => {
      marker.openPopup();
    }, 1200);
  }
}

// ----------------------------------------------------
// Fetch Properties API
// ----------------------------------------------------
async function fetchProperties() {
  try {
    elements.propertiesList.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>កំពុងទាញយកទិន្នន័យអចលនទ្រព្យ...</p>
      </div>
    `;

    const res = await fetch('/api/properties');
    const result = await res.json();

    if (result.success && Array.isArray(result.data)) {
      state.properties = result.data;
      state.filteredProperties = [...state.properties];
      renderData();
    } else {
      showToast('⚠️ មិនអាចទាញយកទិន្នន័យបានទេ');
    }
  } catch (error) {
    console.error('Fetch error:', error);
    showToast('⚠️ មានបញ្ហាក្នុងការភ្ជាប់ទៅ Server');
  }
}

// ----------------------------------------------------
// Details Modal Logic
// ----------------------------------------------------
function openDetailsModal(propertyId) {
  const property = state.properties.find(p => p.id === Number(propertyId));
  if (!property) return;

  state.selectedProperty = property;
  triggerHaptic('impact', 'medium');

  elements.modalImage.src = property.image_url || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80';
  elements.modalTitle.textContent = property.title;
  elements.modalNotes.textContent = property.notes || 'គ្មានកត់ចំណាំបន្ថែម';
  elements.modalDateTag.textContent = new Date(property.created_at).toLocaleString('km-KH');
  elements.modalCoords.textContent = `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}`;

  // Set navigation URLs
  const lat = property.latitude;
  const lng = property.longitude;
  elements.btnGoogleMaps.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  elements.btnWaze.href = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  elements.btnAppleMaps.href = `https://maps.apple.com/?daddr=${lat},${lng}`;

  elements.detailsModal.classList.add('active');
}

function closeDetailsModal() {
  elements.detailsModal.classList.remove('active');
  state.selectedProperty = null;
}

// Delete Property
async function deleteSelectedProperty() {
  if (!state.selectedProperty) return;

  const confirmed = confirm(`តើអ្នកពិតជាចង់លុប "${state.selectedProperty.title}" មែនទេ?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`/api/properties/${state.selectedProperty.id}`, {
      method: 'DELETE'
    });
    const result = await res.json();

    if (result.success) {
      triggerHaptic('notification', 'success');
      showToast('🗑️ បានលុបអចលនទ្រព្យជោគជ័យ');
      closeDetailsModal();
      await fetchProperties();
    } else {
      showToast('⚠️ មិនអាចលុបបានទេ');
    }
  } catch (err) {
    console.error('Delete error:', err);
    showToast('⚠️ បរាជ័យក្នុងការលុប');
  }
}

// ----------------------------------------------------
// Drawer Controls
// ----------------------------------------------------
function toggleDrawer() {
  triggerHaptic('impact', 'light');
  elements.drawer.classList.toggle('open');
}

function closeDrawer() {
  elements.drawer.classList.remove('open');
}

// ----------------------------------------------------
// Geolocation: My Location
// ----------------------------------------------------
function locateUser() {
  triggerHaptic('impact', 'medium');
  if (!navigator.geolocation) {
    showToast('❌ ឧបករណ៍របស់អ្នកមិនគាំទ្រ GPS ទេ');
    return;
  }

  showToast('📡 កំពុងស្វែងរកទីតាំងរបស់អ្នក...');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      state.map.flyTo([latitude, longitude], 16);

      // Add temporary user location marker
      L.circleMarker([latitude, longitude], {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(state.map)
        .bindPopup('<b>📍 ទីតាំងបច្ចុប្បន្នរបស់អ្នក</b>')
        .openPopup();

      showToast('📍 បានកំណត់ទីតាំងរបស់អ្នកហើយ');
    },
    (err) => {
      console.warn('Geolocation error:', err);
      showToast('⚠️ មិនអាចទាញយក GPS បានទេ');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ----------------------------------------------------
// Search & Filter
// ----------------------------------------------------
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  elements.clearSearch.style.display = query ? 'block' : 'none';

  state.filteredProperties = state.properties.filter(p => {
    const matchTitle = p.title && p.title.toLowerCase().includes(query);
    const matchNotes = p.notes && p.notes.toLowerCase().includes(query);
    return matchTitle || matchNotes;
  });

  renderData();
}

function clearSearchInput() {
  elements.searchInput.value = '';
  elements.clearSearch.style.display = 'none';
  state.filteredProperties = [...state.properties];
  renderData();
}

// ----------------------------------------------------
// Event Listeners Setup
// ----------------------------------------------------
function setupEventListeners() {
  // Drawer Toggles
  elements.btnToggleList.addEventListener('click', toggleDrawer);
  elements.drawerHandle.addEventListener('click', toggleDrawer);
  elements.btnCloseDrawer.addEventListener('click', closeDrawer);

  // Map Controls
  elements.btnLayerSwitch.addEventListener('click', toggleMapLayer);
  elements.btnLocateMe.addEventListener('click', locateUser);
  elements.btnRefresh.addEventListener('click', () => {
    triggerHaptic('impact', 'light');
    showToast('🔄 កំពុងផ្ទុកទិន្នន័យឡើងវិញ...');
    fetchProperties();
  });

  // Search
  elements.searchInput.addEventListener('input', handleSearch);
  elements.clearSearch.addEventListener('click', clearSearchInput);

  // Modal
  elements.modalCloseBtn.addEventListener('click', closeDetailsModal);
  elements.modalBackdrop.addEventListener('click', closeDetailsModal);
  elements.btnDeleteProperty.addEventListener('click', deleteSelectedProperty);
}

// Expose modal function for inline HTML popup button
window.app = {
  openDetailsModal
};

// ----------------------------------------------------
// App Bootstrapping
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  setupEventListeners();
  fetchProperties();
});
