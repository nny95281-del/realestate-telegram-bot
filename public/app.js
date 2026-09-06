/**
 * Real Estate Geotagging Mini App Frontend Logic
 * Leaflet.js Map + Telegram WebApp SDK Integration + Pro Features (Status & Measurement)
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
  activeFilter: 'all',
  userLocation: null,
  map: null,
  markersLayer: null,
  currentLayerType: 'street', // 'street' or 'satellite'
  streetTileLayer: null,
  satelliteTileLayer: null,
  selectedProperty: null,
  // Map Pin Dropper state
  isPickingLocation: false,
  pickerMarker: null,
  pickedCoords: null,
  // Photo upload state
  uploadedPhotoBase64: null,
  // Land Measurement State
  isMeasuring: false,
  measurePoints: [],
  measureLayer: null
};

// Tile Layer URLs
const STREET_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

// Type Labels & Icons Mapping
const PROPERTY_TYPES = {
  villa: { label: '🏠 ផ្ទះ/វីឡា', short: 'Villa' },
  condo: { label: '🏢 ខុនដូ', short: 'Condo' },
  land: { label: '🌾 ដីឡូត៍', short: 'Land' },
  shophouse: { label: '🏪 ផ្ទះអាជីវកម្ម', short: 'Shop' },
  house: { label: '🏠 ផ្ទះ', short: 'House' }
};

// Status Labels Mapping
const PROPERTY_STATUSES = {
  available: { label: '🟢 សម្រាប់លក់', class: 'available', text: 'សម្រាប់លក់' },
  booked: { label: '🟡 បានកក់', class: 'booked', text: 'បានកក់' },
  sold: { label: '🔴 លក់ដាច់', class: 'sold', text: 'លក់ដាច់' }
};

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
  btnMeasureTool: document.getElementById('btn-measure-tool'),
  filterPills: document.querySelectorAll('.filter-pill'),
  // Measure Banner Elements
  measureBanner: document.getElementById('measure-banner'),
  measureResult: document.getElementById('measure-result'),
  btnClearMeasure: document.getElementById('btn-clear-measure'),
  // Add Property Elements
  btnAddProperty: document.getElementById('btn-add-property'),
  addModal: document.getElementById('add-modal'),
  addModalBackdrop: document.getElementById('add-modal-backdrop'),
  addModalCloseBtn: document.getElementById('add-modal-close-btn'),
  addPropertyForm: document.getElementById('add-property-form'),
  addTitle: document.getElementById('add-title'),
  addType: document.getElementById('add-type'),
  addStatus: document.getElementById('add-status'),
  addPrice: document.getElementById('add-price'),
  addOwnerName: document.getElementById('add-owner-name'),
  addOwnerPhone: document.getElementById('add-owner-phone'),
  addLat: document.getElementById('add-lat'),
  addLng: document.getElementById('add-lng'),
  addNotes: document.getElementById('add-notes'),
  btnPickOnMap: document.getElementById('btn-pick-on-map'),
  btnUseMyGps: document.getElementById('btn-use-my-gps'),
  // Photo Upload Elements
  photoUploadContainer: document.getElementById('photo-upload-container'),
  addPhotoFile: document.getElementById('add-photo-file'),
  photoUploadPlaceholder: document.getElementById('photo-upload-placeholder'),
  photoPreviewWrapper: document.getElementById('photo-preview-wrapper'),
  photoPreviewImg: document.getElementById('photo-preview-img'),
  btnRemovePhoto: document.getElementById('btn-remove-photo'),
  // Pin Picker Bar Elements
  pinPickerBar: document.getElementById('pin-picker-bar'),
  btnCancelPinPick: document.getElementById('btn-cancel-pin-pick'),
  btnConfirmPinPick: document.getElementById('btn-confirm-pin-pick'),
  // Details Modal Elements
  detailsModal: document.getElementById('details-modal'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalImage: document.getElementById('modal-image'),
  modalTypeBadge: document.getElementById('modal-type-badge'),
  modalStatusBadge: document.getElementById('modal-status-badge'),
  statusBtns: document.querySelectorAll('.status-btn'),
  modalDateTag: document.getElementById('modal-date-tag'),
  modalTitle: document.getElementById('modal-title'),
  modalPrice: document.getElementById('modal-price'),
  modalOwnerCard: document.getElementById('modal-owner-card'),
  modalOwnerName: document.getElementById('modal-owner-name'),
  btnCallOwner: document.getElementById('btn-call-owner'),
  btnTgOwner: document.getElementById('btn-tg-owner'),
  modalNotes: document.getElementById('modal-notes'),
  modalCoords: document.getElementById('modal-coords'),
  btnCopyCoords: document.getElementById('btn-copy-coords'),
  btnGoogleMaps: document.getElementById('btn-google-maps'),
  btnWaze: document.getElementById('btn-waze'),
  btnAppleMaps: document.getElementById('btn-apple-maps'),
  btnEditProperty: document.getElementById('btn-edit-property'),
  btnShareProperty: document.getElementById('btn-share-property'),
  btnDeleteProperty: document.getElementById('btn-delete-property'),
  // Edit Property Modal Elements
  editModal: document.getElementById('edit-modal'),
  editModalBackdrop: document.getElementById('edit-modal-backdrop'),
  editModalCloseBtn: document.getElementById('edit-modal-close-btn'),
  editPropertyForm: document.getElementById('edit-property-form'),
  editId: document.getElementById('edit-id'),
  editTitle: document.getElementById('edit-title'),
  editType: document.getElementById('edit-type'),
  editStatus: document.getElementById('edit-status'),
  editPrice: document.getElementById('edit-price'),
  editOwnerName: document.getElementById('edit-owner-name'),
  editOwnerPhone: document.getElementById('edit-owner-phone'),
  editNotes: document.getElementById('edit-notes'),
  toast: document.getElementById('toast')
};

// ----------------------------------------------------
// Toast Notifications & Haptics
// ----------------------------------------------------
function showToast(message, duration = 2500) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, duration);
}

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
// Distance Calculation (Haversine Formula)
// ----------------------------------------------------
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (d < 1) {
    return `${Math.round(d * 1000)} m`;
  }
  return `${d.toFixed(1)} km`;
}

// ----------------------------------------------------
// Map Initialization
// ----------------------------------------------------
function initMap() {
  state.map = L.map('map', {
    center: [11.5564, 104.9282],
    zoom: 13,
    zoomControl: false
  });

  state.streetTileLayer = L.tileLayer(STREET_TILES, {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
  });

  state.satelliteTileLayer = L.tileLayer(SATELLITE_TILES, {
    attribution: '&copy; Esri Imagery',
    maxZoom: 19
  });

  state.streetTileLayer.addTo(state.map);
  state.markersLayer = L.layerGroup().addTo(state.map);
  state.measureLayer = L.layerGroup().addTo(state.map);

  // Map Click Listener
  state.map.on('click', (e) => {
    if (state.isPickingLocation) {
      updatePickerPosition(e.latlng.lat, e.latlng.lng);
    } else if (state.isMeasuring) {
      addMeasurePoint(e.latlng);
    }
  });
}

// Switch Map Layers (Street <-> Satellite)
function toggleMapLayer() {
  triggerHaptic('impact', 'medium');
  if (state.currentLayerType === 'street') {
    state.map.removeLayer(state.streetTileLayer);
    state.satelliteTileLayer.addTo(state.map);
    state.currentLayerType = 'satellite';
    elements.statActiveLayer.textContent = 'Satellite';
    showToast('🗺️ បានប្តូរទៅទម្រង់ផ្កាយរណប (Satellite)');
  } else {
    state.map.removeLayer(state.satelliteTileLayer);
    state.streetTileLayer.addTo(state.map);
    state.currentLayerType = 'street';
    elements.statActiveLayer.textContent = 'Street';
    showToast('🗺️ បានប្តូរទៅទម្រង់ផែនទីផ្លូវ (Street View)');
  }
}

// ----------------------------------------------------
// Land Area & Distance Measurement Tool
// ----------------------------------------------------
function toggleMeasureTool() {
  triggerHaptic('impact', 'medium');
  state.isMeasuring = !state.isMeasuring;

  if (state.isMeasuring) {
    elements.measureBanner.style.display = 'flex';
    elements.btnMeasureTool.style.background = '#10b981';
    state.measurePoints = [];
    state.measureLayer.clearLayers();
    elements.measureResult.textContent = 'ចុចលើផែនទីដើម្បីវាស់';
    showToast('📏 របៀបវាស់ដី៖ ចុចតាមជ្រុងព្រំដីលើផែនទី');
  } else {
    clearMeasurement();
  }
}

function addMeasurePoint(latlng) {
  triggerHaptic('impact', 'light');
  state.measurePoints.push(latlng);

  state.measureLayer.clearLayers();

  // Draw points
  state.measurePoints.forEach((pt, idx) => {
    L.circleMarker(pt, {
      radius: 6,
      fillColor: '#10b981',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1
    }).addTo(state.measureLayer);
  });

  if (state.measurePoints.length === 2) {
    // Distance
    const p1 = state.measurePoints[0];
    const p2 = state.measurePoints[1];
    const dist = calculateDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    L.polyline(state.measurePoints, { color: '#10b981', weight: 3, dashArray: '5, 5' }).addTo(state.measureLayer);
    elements.measureResult.textContent = `ប្រវែង៖ ${dist}`;
  } else if (state.measurePoints.length >= 3) {
    // Polygon & Area calculation
    L.polygon(state.measurePoints, {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.25,
      weight: 2
    }).addTo(state.measureLayer);

    const areaM2 = calculatePolygonArea(state.measurePoints);
    if (areaM2 >= 10000) {
      elements.measureResult.textContent = `ទំហំ៖ ${(areaM2 / 10000).toFixed(2)} ហិកតា (${Math.round(areaM2).toLocaleString()} m²)`;
    } else {
      elements.measureResult.textContent = `ទំហំ៖ ${Math.round(areaM2).toLocaleString()} ម៉ែត្រការ៉េ (m²)`;
    }
  }
}

// Calculate approximate planar area for small geographic polygon in m²
function calculatePolygonArea(latLngs) {
  if (latLngs.length < 3) return 0;
  const radius = 6378137;
  let total = 0;
  for (let i = 0; i < latLngs.length; i++) {
    const p1 = latLngs[i];
    const p2 = latLngs[(i + 1) % latLngs.length];
    total += (p2.lng * Math.PI / 180 - p1.lng * Math.PI / 180) *
             (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
  }
  return Math.abs(total * radius * radius / 2);
}

function clearMeasurement() {
  state.isMeasuring = false;
  elements.measureBanner.style.display = 'none';
  elements.btnMeasureTool.style.background = '';
  state.measurePoints = [];
  state.measureLayer.clearLayers();
}

// ----------------------------------------------------
// Pin Dropper (Pick Location on Map)
// ----------------------------------------------------
function startPickingLocation() {
  triggerHaptic('impact', 'medium');
  closeAddModal();
  state.isPickingLocation = true;
  elements.pinPickerBar.style.display = 'flex';

  const center = state.map.getCenter();
  const initLat = parseFloat(elements.addLat.value) || center.lat;
  const initLng = parseFloat(elements.addLng.value) || center.lng;

  const pickerIcon = L.divIcon({
    className: 'picker-pin-icon',
    html: `
      <div style="transform: translate(-50%, -100%); text-align: center; cursor: grab;">
        <div style="font-size: 2.2rem; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.6));">📍</div>
        <div style="background: #2563eb; color: #fff; font-size: 0.72rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; white-space: nowrap; margin-top: -6px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
          អូស ឬចុចទីតាំងនេះ
        </div>
      </div>
    `,
    iconSize: [0, 0]
  });

  if (state.pickerMarker) {
    state.map.removeLayer(state.pickerMarker);
  }

  state.pickerMarker = L.marker([initLat, initLng], {
    icon: pickerIcon,
    draggable: true
  }).addTo(state.map);

  state.pickedCoords = { lat: initLat, lng: initLng };

  state.pickerMarker.on('dragend', (e) => {
    const latlng = e.target.getLatLng();
    state.pickedCoords = { lat: latlng.lat, lng: latlng.lng };
    triggerHaptic('impact', 'light');
  });

  state.map.flyTo([initLat, initLng], 16);
  showToast('📍 សូមចុចលើផែនទី ឬអូស Pin ទៅកាន់ទីតាំងអចលនទ្រព្យ');
}

function updatePickerPosition(lat, lng) {
  state.pickedCoords = { lat, lng };
  if (state.pickerMarker) {
    state.pickerMarker.setLatLng([lat, lng]);
  }
  triggerHaptic('impact', 'light');
}

function confirmLocationPick() {
  triggerHaptic('notification', 'success');
  if (state.pickedCoords) {
    elements.addLat.value = state.pickedCoords.lat.toFixed(6);
    elements.addLng.value = state.pickedCoords.lng.toFixed(6);
  }
  stopPickingLocation();
  openAddModal();
  showToast('✅ បានកំណត់កូអរដោនេទីតាំងរួចរាល់!');
}

function cancelLocationPick() {
  stopPickingLocation();
  openAddModal();
}

function stopPickingLocation() {
  state.isPickingLocation = false;
  elements.pinPickerBar.style.display = 'none';
  if (state.pickerMarker) {
    state.map.removeLayer(state.pickerMarker);
    state.pickerMarker = null;
  }
}

// ----------------------------------------------------
// Photo File Upload & Compression
// ----------------------------------------------------
function handlePhotoFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('⚠️ សូមជ្រើសរើស File រូបភាព');
    return;
  }

  showToast('⏳ កំពុងដំណើរការរូបភាព...');
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDim = 1200;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      state.uploadedPhotoBase64 = base64;

      elements.photoPreviewImg.src = base64;
      elements.photoUploadPlaceholder.style.display = 'none';
      elements.photoPreviewWrapper.style.display = 'block';
      triggerHaptic('notification', 'success');
      showToast('📸 បានបញ្ចូលរូបភាពជោគជ័យ!');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function removeSelectedPhoto(e) {
  if (e) e.stopPropagation();
  state.uploadedPhotoBase64 = null;
  elements.addPhotoFile.value = '';
  elements.photoPreviewImg.src = '';
  elements.photoPreviewWrapper.style.display = 'none';
  elements.photoUploadPlaceholder.style.display = 'flex';
}

// ----------------------------------------------------
// Custom Leaflet Marker Generator
// ----------------------------------------------------
function createCustomPin(property) {
  const thumbUrl = property.image_url || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=150&q=80';
  const statusInfo = PROPERTY_STATUSES[property.status] || PROPERTY_STATUSES.available;

  let pinBorderColor = '#2563eb';
  if (property.status === 'booked') pinBorderColor = '#f59e0b';
  if (property.status === 'sold') pinBorderColor = '#ef4444';

  const customIcon = L.divIcon({
    className: 'custom-map-pin-container',
    html: `
      <div class="custom-map-pin" id="pin-${property.id}">
        <div class="pin-badge" style="border-color: ${pinBorderColor};">
          <img src="${thumbUrl}" alt="Thumb" onerror="this.src='https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=150&q=80'" />
        </div>
        <div class="pin-arrow" style="border-top-color: ${pinBorderColor};"></div>
      </div>
    `,
    iconSize: [46, 54],
    iconAnchor: [23, 54],
    popupAnchor: [0, -50]
  });

  const marker = L.marker([property.latitude, property.longitude], { icon: customIcon });

  const dateFormatted = new Date(property.created_at).toLocaleDateString('km-KH');
  const priceBadgeHtml = property.price ? `<div class="popup-price-badge">${escapeHtml(property.price)}</div>` : '';

  const popupHtml = `
    <div class="popup-card">
      <div class="popup-img-wrapper">
        <img src="${thumbUrl}" alt="${property.title}" />
        ${priceBadgeHtml}
      </div>
      <div class="popup-body">
        <div class="popup-title">${escapeHtml(property.title)}</div>
        <div style="font-size: 0.72rem; color: #94a3b8; margin-bottom: 6px;">${statusInfo.label}</div>
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
        <i class="fa-solid fa-house-chimney-crack"></i>
        <p>មិនទាន់មានអចលនទ្រព្យត្រូវបានកត់ត្រានៅឡើយទេ</p>
        <p style="font-size: 0.75rem; color: #64748b; margin-top: 4px;">
          សូមផ្ញើរូបភាព និងទីតាំងក្នុង Bot ឬចុចប៊ូតុង <b>+</b> ខាងលើដើម្បីបន្ថែម
        </p>
      </div>
    `;
    return;
  }

  const bounds = [];

  list.forEach((prop) => {
    const marker = createCustomPin(prop);
    state.markersLayer.addLayer(marker);
    bounds.push([prop.latitude, prop.longitude]);

    const thumbUrl = prop.image_url || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=150&q=80';
    const dateFormatted = new Date(prop.created_at).toLocaleDateString('km-KH');
    const statusInfo = PROPERTY_STATUSES[prop.status] || PROPERTY_STATUSES.available;

    let distBadge = '';
    if (state.userLocation) {
      const dist = calculateDistance(state.userLocation.lat, state.userLocation.lng, prop.latitude, prop.longitude);
      distBadge = `<span class="prop-dist-badge"><i class="fa-solid fa-person-walking"></i> ${dist}</span>`;
    }

    const priceHtml = prop.price ? `<span class="prop-price-tag">${escapeHtml(prop.price)}</span>` : '';

    const card = document.createElement('div');
    card.className = 'property-card-item';
    card.innerHTML = `
      <img src="${thumbUrl}" class="prop-thumb" alt="Thumbnail" />
      <div class="prop-info">
        <div class="prop-title-row">
          <div class="prop-title">${escapeHtml(prop.title)}</div>
          ${priceHtml}
        </div>
        <div style="font-size: 0.72rem; margin-bottom: 3px;">
          <span style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 6px;">${statusInfo.label}</span>
        </div>
        <div class="prop-notes">${escapeHtml(prop.notes || 'គ្មានកត់ចំណាំ')}</div>
        <div class="prop-meta">
          <div class="prop-meta-left">
            <span><i class="fa-solid fa-location-dot"></i> ${prop.latitude.toFixed(4)}, ${prop.longitude.toFixed(4)}</span>
            ${distBadge}
          </div>
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

  if (bounds.length > 0 && !elements.searchInput.value && state.activeFilter === 'all') {
    state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }
}

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
      applyFilters();
    } else {
      showToast('⚠️ មិនអាចទាញយកទិន្នន័យបានទេ');
    }
  } catch (error) {
    console.error('Fetch error:', error);
    showToast('⚠️ មានបញ្ហាក្នុងការភ្ជាប់ទៅ Server');
  }
}

function applyFilters() {
  const query = elements.searchInput.value.toLowerCase().trim();
  const filter = state.activeFilter;

  state.filteredProperties = state.properties.filter(p => {
    let matchFilter = true;
    if (filter.startsWith('status-')) {
      const statusKey = filter.replace('status-', '');
      matchFilter = (p.status || 'available') === statusKey;
    } else if (filter.startsWith('type-')) {
      const typeKey = filter.replace('type-', '');
      matchFilter = p.property_type === typeKey;
    }

    const matchTitle = p.title && p.title.toLowerCase().includes(query);
    const matchNotes = p.notes && p.notes.toLowerCase().includes(query);
    const matchPrice = p.price && p.price.toLowerCase().includes(query);
    const matchOwner = p.owner_phone && p.owner_phone.includes(query);

    return matchFilter && (matchTitle || matchNotes || matchPrice || matchOwner || !query);
  });

  renderData();
}

// ----------------------------------------------------
// Details Modal Logic & Status Switcher
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

  const typeInfo = PROPERTY_TYPES[property.property_type] || PROPERTY_TYPES.house;
  elements.modalTypeBadge.textContent = typeInfo.label;

  // Status Badge
  const currentStatus = property.status || 'available';
  const statusInfo = PROPERTY_STATUSES[currentStatus] || PROPERTY_STATUSES.available;
  elements.modalStatusBadge.textContent = statusInfo.label;
  elements.modalStatusBadge.className = `modal-status-badge ${statusInfo.class}`;

  // Update Status Switcher active state
  elements.statusBtns.forEach(btn => {
    const btnStatus = btn.getAttribute('data-set-status');
    btn.className = `status-btn ${btnStatus} ${btnStatus === currentStatus ? 'active' : ''}`;
  });

  if (property.price) {
    elements.modalPrice.textContent = property.price;
    elements.modalPrice.style.display = 'block';
  } else {
    elements.modalPrice.style.display = 'none';
  }

  // Owner Info Box
  if (property.owner_phone || property.owner_name) {
    const displayName = property.owner_name ? `${property.owner_name} (${property.owner_phone})` : property.owner_phone;
    elements.modalOwnerName.textContent = displayName;
    elements.modalOwnerCard.style.display = 'flex';

    if (property.owner_phone) {
      const cleanPhone = property.owner_phone.replace(/[^0-9+]/g, '');
      elements.btnCallOwner.href = `tel:${cleanPhone}`;
      elements.btnCallOwner.style.display = 'flex';
      elements.btnTgOwner.href = `https://t.me/+${cleanPhone.replace(/^0/, '855')}`;
      elements.btnTgOwner.style.display = 'flex';
    } else {
      elements.btnCallOwner.style.display = 'none';
      elements.btnTgOwner.style.display = 'none';
    }
  } else {
    elements.modalOwnerCard.style.display = 'none';
  }

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

// 1-Click Status Switcher
async function handleStatusSwitch(newStatus) {
  if (!state.selectedProperty) return;
  triggerHaptic('impact', 'medium');

  const id = state.selectedProperty.id;
  try {
    const res = await fetch(`/api/properties/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const result = await res.json();

    if (result.success) {
      triggerHaptic('notification', 'success');
      showToast(`✅ បានប្តូរស្ថានភាពទៅ៖ ${PROPERTY_STATUSES[newStatus].label}`);
      await fetchProperties();
      openDetailsModal(id);
    }
  } catch (err) {
    console.error('Status error:', err);
    showToast('⚠️ មិនអាចប្តូរស្ថានភាពបានទេ');
  }
}

// Copy Coordinates
function copyCoordsToClipboard() {
  if (!state.selectedProperty) return;
  const coords = `${state.selectedProperty.latitude.toFixed(6)}, ${state.selectedProperty.longitude.toFixed(6)}`;
  navigator.clipboard.writeText(coords).then(() => {
    triggerHaptic('notification', 'success');
    showToast('📋 បានចម្លងកូអរដោនេ GPS រួចរាល់!');
  });
}

// Share Property Link directly to Telegram
function sharePropertyDetails() {
  if (!state.selectedProperty) return;
  const p = state.selectedProperty;
  const typeInfo = PROPERTY_TYPES[p.property_type] || PROPERTY_TYPES.house;
  const statusInfo = PROPERTY_STATUSES[p.status] || PROPERTY_STATUSES.available;
  const priceText = p.price ? `💰 តម្លៃ: ${p.price}\n` : '';
  const statusText = `📌 ស្ថានភាព: ${statusInfo.label}\n`;
  const ownerText = p.owner_phone ? `📞 ម្ចាស់ផ្ទះ: ${p.owner_name ? p.owner_name + ' - ' : ''}${p.owner_phone}\n` : '';
  const notesText = p.notes ? `📝 ${p.notes}\n` : '';
  const coordsText = `📍 ទីតាំង GPS: ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
  
  const shareText = `${typeInfo.label} - ${p.title}\n${priceText}${statusText}${ownerText}${notesText}${coordsText}\n🗺️ ផែនទី: ${gmapsUrl}`;

  triggerHaptic('impact', 'medium');

  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(gmapsUrl)}&text=${encodeURIComponent(shareText)}`;

  if (tg && tg.openTelegramLink) {
    tg.openTelegramLink(telegramShareUrl);
  } else if (navigator.share) {
    navigator.share({
      title: p.title,
      text: shareText,
      url: gmapsUrl
    }).catch(() => {});
  } else {
    window.open(telegramShareUrl, '_blank');
  }
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
// Manual Add Property Modal Logic
// ----------------------------------------------------
function openAddModal() {
  triggerHaptic('impact', 'light');
  if (!elements.addLat.value && state.userLocation) {
    elements.addLat.value = state.userLocation.lat.toFixed(6);
    elements.addLng.value = state.userLocation.lng.toFixed(6);
  }
  elements.addModal.classList.add('active');
}

function closeAddModal() {
  elements.addModal.classList.remove('active');
}

async function handleAddPropertySubmit(e) {
  e.preventDefault();
  triggerHaptic('impact', 'medium');

  const title = elements.addTitle.value.trim();
  const propertyType = elements.addType.value;
  const status = elements.addStatus.value;
  const price = elements.addPrice.value.trim();
  const ownerName = elements.addOwnerName ? elements.addOwnerName.value.trim() : '';
  const ownerPhone = elements.addOwnerPhone ? elements.addOwnerPhone.value.trim() : '';
  const latitude = parseFloat(elements.addLat.value);
  const longitude = parseFloat(elements.addLng.value);
  const notes = elements.addNotes.value.trim();

  if (!title || isNaN(latitude) || isNaN(longitude)) {
    showToast('⚠️ សូមបំពេញឈ្មោះ និងកូអរដោនេឱ្យបានត្រឹមត្រូវ');
    return;
  }

  showToast('⏳ កំពុងរក្សាទុក...');

  try {
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        propertyType,
        status,
        price,
        ownerName,
        ownerPhone,
        latitude,
        longitude,
        imageBase64: state.uploadedPhotoBase64 || undefined,
        notes
      })
    });

    const result = await res.json();
    if (result.success) {
      triggerHaptic('notification', 'success');
      showToast('🎉 បានរក្សាទុកអចលនទ្រព្យថ្មីជោគជ័យ!');
      elements.addPropertyForm.reset();
      removeSelectedPhoto();
      closeAddModal();
      await fetchProperties();
      state.map.flyTo([latitude, longitude], 17);
    } else {
      showToast('⚠️ មិនអាចរក្សាទុកបានទេ');
    }
  } catch (err) {
    console.error('Add error:', err);
    showToast('⚠️ បរាជ័យក្នុងការរក្សាទុក');
  }
}

// ----------------------------------------------------
// Edit Property Modal Logic
// ----------------------------------------------------
function openEditModal() {
  if (!state.selectedProperty) return;
  const p = state.selectedProperty;
  triggerHaptic('impact', 'light');

  elements.editId.value = p.id;
  elements.editTitle.value = p.title || '';
  elements.editType.value = p.property_type || 'villa';
  elements.editStatus.value = p.status || 'available';
  elements.editPrice.value = p.price || '';
  elements.editOwnerName.value = p.owner_name || '';
  elements.editOwnerPhone.value = p.owner_phone || '';
  elements.editNotes.value = p.notes || '';

  closeDetailsModal();
  elements.editModal.classList.add('active');
}

function closeEditModal() {
  elements.editModal.classList.remove('active');
}

async function handleEditPropertySubmit(e) {
  e.preventDefault();
  triggerHaptic('impact', 'medium');

  const id = elements.editId.value;
  const title = elements.editTitle.value.trim();
  const propertyType = elements.editType.value;
  const status = elements.editStatus.value;
  const price = elements.editPrice.value.trim();
  const ownerName = elements.editOwnerName.value.trim();
  const ownerPhone = elements.editOwnerPhone.value.trim();
  const notes = elements.editNotes.value.trim();

  if (!title) {
    showToast('⚠️ សូមបំពេញឈ្មោះអចលនទ្រព្យ');
    return;
  }

  showToast('⏳ កំពុងរក្សាទុកការកែប្រែ...');

  try {
    const res = await fetch(`/api/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        propertyType,
        status,
        price,
        ownerName,
        ownerPhone,
        notes
      })
    });

    const result = await res.json();
    if (result.success) {
      triggerHaptic('notification', 'success');
      showToast('🎉 បានកែប្រែព័ត៌មានជោគជ័យ!');
      closeEditModal();
      await fetchProperties();
      openDetailsModal(Number(id));
    } else {
      showToast('⚠️ មិនអាចកែប្រែបានទេ');
    }
  } catch (err) {
    console.error('Edit error:', err);
    showToast('⚠️ បរាជ័យក្នុងការកែប្រែ');
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
      state.userLocation = { lat: latitude, lng: longitude };
      state.map.flyTo([latitude, longitude], 16);

      L.circleMarker([latitude, longitude], {
        radius: 9,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95
      }).addTo(state.map)
        .bindPopup('<b>📍 ទីតាំងបច្ចុប្បន្នរបស់អ្នក</b>')
        .openPopup();

      showToast('📍 បានកំណត់ទីតាំងរបស់អ្នកហើយ');
      renderData();
    },
    (err) => {
      console.warn('Geolocation error:', err);
      showToast('⚠️ មិនអាចទាញយក GPS បានទេ');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
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
  elements.btnMeasureTool.addEventListener('click', toggleMeasureTool);
  elements.btnClearMeasure.addEventListener('click', clearMeasurement);

  elements.btnRefresh.addEventListener('click', () => {
    triggerHaptic('impact', 'light');
    showToast('🔄 កំពុងផ្ទុកទិន្នន័យឡើងវិញ...');
    fetchProperties();
  });

  // Search
  elements.searchInput.addEventListener('input', () => {
    elements.clearSearch.style.display = elements.searchInput.value ? 'block' : 'none';
    applyFilters();
  });
  elements.clearSearch.addEventListener('click', () => {
    elements.searchInput.value = '';
    elements.clearSearch.style.display = 'none';
    applyFilters();
  });

  // Filter Pills (Category & Status)
  elements.filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      triggerHaptic('impact', 'light');
      elements.filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.getAttribute('data-filter');
      applyFilters();
    });
  });

  // Photo Upload
  elements.photoUploadContainer.addEventListener('click', () => {
    elements.addPhotoFile.click();
  });
  elements.addPhotoFile.addEventListener('change', handlePhotoFileSelect);
  elements.btnRemovePhoto.addEventListener('click', removeSelectedPhoto);

  // Pin Picker on Map
  elements.btnPickOnMap.addEventListener('click', startPickingLocation);
  elements.btnConfirmPinPick.addEventListener('click', confirmLocationPick);
  elements.btnCancelPinPick.addEventListener('click', cancelLocationPick);

  // Add Property Modal
  elements.btnAddProperty.addEventListener('click', openAddModal);
  elements.addModalCloseBtn.addEventListener('click', closeAddModal);
  elements.addModalBackdrop.addEventListener('click', closeAddModal);
  elements.addPropertyForm.addEventListener('submit', handleAddPropertySubmit);
  elements.btnUseMyGps.addEventListener('click', () => {
    if (state.userLocation) {
      elements.addLat.value = state.userLocation.lat.toFixed(6);
      elements.addLng.value = state.userLocation.lng.toFixed(6);
      showToast('📍 បានបញ្ចូលកូអរដោនេ GPS របស់អ្នក');
    } else {
      locateUser();
    }
  });

  // Status Switcher inside Details Modal
  elements.statusBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.getAttribute('data-set-status');
      handleStatusSwitch(newStatus);
    });
  });

  // Details Modal
  elements.modalCloseBtn.addEventListener('click', closeDetailsModal);
  elements.modalBackdrop.addEventListener('click', closeDetailsModal);
  elements.btnDeleteProperty.addEventListener('click', deleteSelectedProperty);
  elements.btnCopyCoords.addEventListener('click', copyCoordsToClipboard);
  elements.btnEditProperty.addEventListener('click', openEditModal);
  elements.btnShareProperty.addEventListener('click', sharePropertyDetails);

  // Edit Modal
  elements.editModalCloseBtn.addEventListener('click', closeEditModal);
  elements.editModalBackdrop.addEventListener('click', closeEditModal);
  elements.editPropertyForm.addEventListener('submit', handleEditPropertySubmit);
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
