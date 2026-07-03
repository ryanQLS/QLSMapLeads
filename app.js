const STORAGE_KEY = 'qls-map-leads-markers';

const state = {
  map: null,
  addMode: false,
  pendingCoords: null,
  editingMarkerId: null,
  activeVisitId: null,
  isReturnMode: false,
  markers: [],
  filters: {
    outcome: 'all',
    returnDate: 'all',
  },
  calendarCollapsed: true,
  calendarTouchStartY: null,
  liveLocationActive: false,
  liveLocationWatchId: null,
  liveLocationMarker: null,
};

const qs = (selector) => document.querySelector(selector);

const elems = {
  map: qs('#map'),
  addPointButton: qs('#addPointButton'),
  detailModal: qs('#detailModal'),
  pinTitleInput: qs('#pinTitleInput'),
  pinContactInput: qs('#pinContactInput'),
  pinContactTypeSelect: qs('#pinContactTypeSelect'),
  pinOutcomeSelect: qs('#pinOutcomeSelect'),
  pinReturnDateField: qs('#pinReturnDateField'),
  pinReturnDateInput: qs('#pinReturnDateInput'),
  pinNotesInput: qs('#pinNotesInput'),
  cancelPinButton: qs('#cancelPinButton'),
  savePinButton: qs('#savePinButton'),
  outcomeFilter: qs('#outcomeFilter'),
  returnDateFilter: qs('#returnDateFilter'),
  calendarPanel: qs('#calendarPanel'),
  calendarToggleButton: qs('#calendarToggleButton'),
  calendarHandle: qs('#calendarHandle'),
  calendarDayFilters: qs('#calendarDayFilters'),
  calendarList: qs('#calendarList'),
  liveLocationButton: qs('#liveLocationButton'),
};

function initApp() {
  initMap();
  setupEventListeners();
  loadMarkers();
  renderFilterOptions();
  renderMarkers();
  renderCalendarPanel();
  updateCalendarPanelState();
}

function initMap() {
  state.map = L.map('map', { zoomControl: true }).setView([37.0902, -95.7129], 4);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  }).addTo(state.map);

  state.map.on('click', onMapClick);
  requestLocation();

  window.addEventListener('load', () => state.map.invalidateSize());
  setTimeout(() => state.map.invalidateSize(), 250);
}

function requestLocation() {
  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      state.map.setView([latitude, longitude], 15);
    },
    () => {
      console.warn('Location access denied or unavailable');
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
}

function toggleLiveLocation() {
  if (!navigator.geolocation) {
    alert('Live location is not supported by this browser.');
    return;
  }

  if (state.liveLocationActive) {
    stopLiveLocation();
  } else {
    startLiveLocation();
  }
}

function startLiveLocation() {
  if (!navigator.geolocation) {
    return;
  }

  state.liveLocationActive = true;
  elems.liveLocationButton.classList.add('active');

  state.liveLocationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      updateLiveLocationMarker(latitude, longitude);
      state.map.setView([latitude, longitude], 15);
    },
    (error) => {
      console.warn('Live location error:', error.message);
      if (error.code === error.PERMISSION_DENIED) {
        stopLiveLocation();
      }
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

function stopLiveLocation() {
  if (state.liveLocationWatchId !== null) {
    navigator.geolocation.clearWatch(state.liveLocationWatchId);
    state.liveLocationWatchId = null;
  }

  state.liveLocationActive = false;
  elems.liveLocationButton.classList.remove('active');

  if (state.liveLocationMarker) {
    state.map.removeLayer(state.liveLocationMarker);
    state.liveLocationMarker = null;
  }
}

function updateLiveLocationMarker(lat, lng) {
  if (!state.liveLocationMarker) {
    state.liveLocationMarker = L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: '#2563eb',
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(state.map);
  } else {
    state.liveLocationMarker.setLatLng([lat, lng]);
  }
}

function setupEventListeners() {
  elems.addPointButton.addEventListener('click', toggleAddMode);
  elems.liveLocationButton.addEventListener('click', toggleLiveLocation);
  elems.cancelPinButton.addEventListener('click', closePinDetailsModal);
  elems.savePinButton.addEventListener('click', savePinDetails);
  elems.pinOutcomeSelect.addEventListener('change', updateReturnDateVisibility);
  elems.outcomeFilter.addEventListener('change', handleFilterChange);
  elems.returnDateFilter.addEventListener('change', handleFilterChange);
  elems.calendarToggleButton.addEventListener('click', toggleCalendarPanel);
  elems.calendarHandle.addEventListener('touchstart', handleCalendarTouchStart, { passive: true });
  elems.calendarHandle.addEventListener('touchend', handleCalendarTouchEnd, { passive: true });
  elems.calendarPanel.addEventListener('touchstart', handleCalendarTouchStart, { passive: true });
  elems.calendarPanel.addEventListener('touchend', handleCalendarTouchEnd, { passive: true });
  elems.calendarDayFilters.addEventListener('click', handleCalendarChipClick);
  elems.calendarList.addEventListener('click', handleCalendarEntryClick);
  elems.detailModal.addEventListener('click', (event) => {
    if (event.target === elems.detailModal) {
      closePinDetailsModal();
    }
  });
}

function toggleAddMode() {
  state.addMode = !state.addMode;
  elems.addPointButton.classList.toggle('active', state.addMode);
}

function onMapClick(event) {
  if (!state.addMode) return;

  const { lat, lng } = event.latlng;
  state.pendingCoords = {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
  openPinDetailsModal();
}

function openPinDetailsModal(markerData = null, options = {}) {
  elems.detailModal.classList.remove('hidden');

  if (markerData) {
    state.pendingCoords = null;
    state.editingMarkerId = markerData.id;
    state.activeVisitId = options.visitId || null;
    state.isReturnMode = Boolean(options.returnMode);
    elems.pinTitleInput.value = markerData.title || '';
    elems.pinContactInput.value = markerData.contact || '';
    elems.pinContactTypeSelect.value = markerData.contactType || '';
    elems.pinOutcomeSelect.value = markerData.outcome || '';

    const visitData = options.visitId ? (markerData.visits || []).find((visit) => visit.id === options.visitId) : null;
    const defaultDate = options.returnMode || options.visitId ? new Date().toISOString().slice(0, 16) : '';
    const rawReturn = visitData?.returnDate || markerData.returnDate || defaultDate;
    // datetime-local requires YYYY-MM-DDTHH:MM — convert date-only strings to a safe default time
    elems.pinReturnDateInput.value = rawReturn && rawReturn.includes('T') ? rawReturn : (rawReturn ? `${rawReturn}T12:00` : '');
    elems.pinNotesInput.value = visitData?.notes || markerData.notes || '';
  } else {
    state.editingMarkerId = null;
    state.activeVisitId = null;
    state.isReturnMode = false;
    elems.pinTitleInput.value = '';
    elems.pinContactInput.value = '';
    elems.pinContactTypeSelect.value = '';
    elems.pinOutcomeSelect.value = '';
    elems.pinReturnDateInput.value = '';
    elems.pinNotesInput.value = '';
  }

  updateReturnDateVisibility();
  elems.savePinButton.textContent = options.returnMode ? 'Save Return' : state.editingMarkerId ? 'Save Changes' : 'Save Pin';
  elems.pinTitleInput.focus();
}

function closePinDetailsModal() {
  elems.detailModal.classList.add('hidden');
  state.pendingCoords = null;
  state.editingMarkerId = null;
  state.activeVisitId = null;
  state.isReturnMode = false;
  state.addMode = false;
  elems.addPointButton.classList.remove('active');
  elems.savePinButton.textContent = 'Save Pin';
}

function savePinDetails() {
  const outcome = elems.pinOutcomeSelect.value;
  const returnDate = canHaveReturnDate(outcome) ? elems.pinReturnDateInput.value : '';
  const notes = elems.pinNotesInput.value.trim();

  if (state.editingMarkerId) {
    const markerData = state.markers.find((item) => item.id === state.editingMarkerId);
    if (!markerData) {
      closePinDetailsModal();
      return;
    }

    markerData.title = elems.pinTitleInput.value.trim() || 'Pin';
    markerData.contact = elems.pinContactInput.value.trim();
    markerData.contactType = elems.pinContactTypeSelect.value;
    markerData.outcome = outcome;
    markerData.notes = notes;
    markerData.returnDate = returnDate;

    if (state.activeVisitId) {
      const visitData = (markerData.visits || []).find((visit) => visit.id === state.activeVisitId);
      if (visitData) {
          visitData.returnDate = returnDate; // keep original createdAt, allow editing scheduled returnDate and notes
        visitData.notes = notes;
      }
      // Ensure only one visit with a returnDate exists: remove other return-dated visits
      if (Array.isArray(markerData.visits)) {
        markerData.visits = markerData.visits.filter((v) => !v.returnDate || v.id === state.activeVisitId);
      }
    } else if (state.isReturnMode && returnDate) {
      if (!Array.isArray(markerData.visits)) {
        markerData.visits = [];
      }
      // Remove any existing return-dated visits so only the new one remains
      markerData.visits = markerData.visits.filter((v) => !v.returnDate);
      const createdAt = new Date().toISOString().slice(0, 10);
      const newVisit = {
        id: crypto.randomUUID(),
        returnDate,
        createdAt,
        notes,
      };
      markerData.visits.push(newVisit);
      if (outcome === 'Appointment') {
        queueGoogleCalendarEvent(newVisit, markerData);
      }
    }

    if (markerData.leafletMarker) {
      markerData.leafletMarker.setPopupContent(createPopupContent(markerData));
    }
  } else {
    if (!state.pendingCoords) return;

    const markerData = {
      id: crypto.randomUUID(),
      lat: state.pendingCoords.lat,
      lng: state.pendingCoords.lng,
      title: elems.pinTitleInput.value.trim() || 'Pin',
      contact: elems.pinContactInput.value.trim(),
      contactType: elems.pinContactTypeSelect.value,
      outcome,
      returnDate,
      notes,
        visits: returnDate ? [{ id: crypto.randomUUID(), returnDate, createdAt: new Date().toISOString().slice(0, 10), notes }] : [],
      leafletMarker: null,
    };

    state.markers.push(markerData);
    if (returnDate && outcome === 'Appointment') {
      queueGoogleCalendarEvent(markerData.visits[0], markerData);
    }
  }

  renderFilterOptions();
  renderMarkers();
  renderCalendarPanel();
  saveMarkers();
  closePinDetailsModal();
}

function renderMarkers() {
  const visibleMarkers = getFilteredMarkers(state.markers, state.filters);
  const visibleIds = new Set(visibleMarkers.map((markerData) => markerData.id));

  state.markers.forEach((markerData) => {
    if (!markerData.leafletMarker) {
      markerData.leafletMarker = L.marker([markerData.lat, markerData.lng], {
        icon: createPinIcon(markerData.outcome),
      });

      markerData.leafletMarker.bindPopup(createPopupContent(markerData), { autoPan: true });
      markerData.leafletMarker.on('click', (event) => {
        event.originalEvent?.stopPropagation();
        markerData.leafletMarker.openPopup();
      });
      markerData.leafletMarker.on('popupopen', () => {
        const popup = markerData.leafletMarker.getPopup()?.getElement();
        if (!popup) return;

        popup.onclick = (event) => {
          const editButton = event.target.closest('[data-action="edit"]');
          if (editButton) {
            event.preventDefault();
            event.stopPropagation();
            markerData.leafletMarker.closePopup();
            openPinDetailsModal(markerData);
            return;
          }

          const returnButton = event.target.closest('[data-action="return"]');
          if (returnButton) {
            event.preventDefault();
            event.stopPropagation();
            markerData.leafletMarker.closePopup();
            openPinDetailsModal(markerData, { returnMode: true });
            return;
          }

          const deleteButton = event.target.closest('[data-action="delete"]');
          if (!deleteButton) return;

          event.preventDefault();
          event.stopPropagation();
          markerData.leafletMarker.closePopup();
          removeMarker(markerData);
        };
      });
    }

    markerData.leafletMarker?.setPopupContent(createPopupContent(markerData));
    markerData.leafletMarker?.setIcon && markerData.leafletMarker.setIcon(createPinIcon(markerData.outcome));

    if (visibleIds.has(markerData.id)) {
      if (!state.map.hasLayer(markerData.leafletMarker)) {
        state.map.addLayer(markerData.leafletMarker);
      }
    } else if (state.map.hasLayer(markerData.leafletMarker)) {
      state.map.removeLayer(markerData.leafletMarker);
    }
  });
}

function createPinIcon() {
  return L.divIcon({
    html: '<div class="pin-marker"></div>',
    className: 'pin-icon-wrapper',
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -24],
  });
}

function createPinIcon(outcome) {
  const map = {
    'Closed Deal': 'closed-deal',
    'Door Locked': 'door-locked',
    'Follow Up': 'follow-up',
    'Appointment': 'appointment',
    'Not Interested': 'not-interested',
    'Other': 'other',
  };
  const cls = map[outcome] || 'default';
  return L.divIcon({
    html: `<div class="pin-marker pin-marker--${cls}"></div>`,
    className: 'pin-icon-wrapper',
    iconSize: [22, 28],
    iconAnchor: [11, 28],
    popupAnchor: [0, -24],
  });
}

function createPopupContent(markerData) {
  const title = escapeHtml(markerData.title || 'Pin');
  const contact = escapeHtml(markerData.contact || '—');
  const contactType = escapeHtml(markerData.contactType || '—');
  const outcome = escapeHtml(markerData.outcome || '—');
  const returnDate = escapeHtml(markerData.returnDate || '—');
  const visits = (markerData.visits || []).filter((visit) => visit.returnDate).sort((a, b) => a.returnDate.localeCompare(b.returnDate));
  const visitMarkup = visits.length
    ? visits.map((visit) => `
        <div class="pin-popup__visit">
          <strong>${escapeHtml(formatCalendarDate(visit.createdAt || visit.returnDate))}</strong>
          <div>${escapeHtml(visit.notes || 'No notes')}</div>
          ${visit.returnDate ? `<div class="pin-popup__visit-scheduled">Scheduled: ${escapeHtml(formatCalendarDate(visit.returnDate))}</div>` : ''}
        </div>
      `).join('')
    : '<div class="pin-popup__visit pin-popup__visit--empty">No return visits yet</div>';

  return `
    <div class="pin-popup">
      <strong>${title}</strong>
      <div><strong>Met:</strong> ${contact}</div>
      <div><strong>Outcome:</strong> ${outcome}</div>
      <div><strong>Contact Type:</strong> ${contactType}</div>
      ${markerData.returnDate ? `<div><strong>Return:</strong> ${returnDate}</div>` : ''}
      <div><strong>Notes:</strong> ${visitMarkup}</div>
      <div class="pin-popup__actions">
        <button data-action="edit" data-id="${markerData.id}">Edit</button>
        <button data-action="return" data-id="${markerData.id}">Return</button>
        <button data-action="delete" data-id="${markerData.id}">Delete</button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateReturnDateVisibility() {
  const shouldShow = canHaveReturnDate(elems.pinOutcomeSelect.value);
  elems.pinReturnDateField.classList.toggle('hidden', !shouldShow);
  elems.pinReturnDateField.classList.toggle('field-disabled', !shouldShow);
  elems.pinReturnDateInput.disabled = !shouldShow;
  if (!shouldShow) {
    elems.pinReturnDateInput.value = '';
  }
}

function handleFilterChange() {
  state.filters.outcome = elems.outcomeFilter.value;
  state.filters.returnDate = elems.returnDateFilter.value;
  renderMarkers();
  renderCalendarPanel();
}

function renderFilterOptions() {
  const dates = getReturnDateOptions(state.markers);
  const currentDate = state.filters.returnDate;
  const availableValues = ['all', 'has-return-date', ...dates];

  elems.returnDateFilter.innerHTML = [
    '<option value="all">All dates</option>',
    '<option value="has-return-date">With return date</option>',
    ...dates.map((date) => `<option value="${escapeHtml(date)}">${escapeHtml(formatCalendarDate(date))}</option>`),
  ].join('');

  if (availableValues.includes(currentDate)) {
    elems.returnDateFilter.value = currentDate;
  } else {
    elems.returnDateFilter.value = 'all';
    state.filters.returnDate = 'all';
  }

  elems.outcomeFilter.value = state.filters.outcome;
}

function handleCalendarChipClick(event) {
  const chip = event.target.closest('[data-calendar-date]');
  if (chip) {
    elems.returnDateFilter.value = chip.dataset.calendarDate;
    handleFilterChange();
    return;
  }
}

function handleCalendarEntryClick(event) {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const markerData = state.markers.find((item) => item.id === actionButton.dataset.markerId);
    if (!markerData) return;

    const action = actionButton.dataset.action;
    markerData.leafletMarker?.closePopup();

    if (action === 'return') {
      openPinDetailsModal(markerData, { returnMode: true });
    } else if (action === 'edit') {
      openPinDetailsModal(markerData);
    } else if (action === 'delete') {
      removeMarker(markerData);
    } else if (action === 'google') {
      openGoogleCalendarForMarker(markerData);
    }
    return;
  }

  const calendarEntry = event.target.closest('.calendar-item__entry');
  if (!calendarEntry) return;

  const markerData = state.markers.find((item) => item.id === calendarEntry.dataset.markerId);
  if (!markerData) return;

  markerData.leafletMarker?.closePopup();
  openPinDetailsModal(markerData);
}

function addAllVisibleToGoogleCalendar() {
  const entries = getCalendarEntries(getFilteredMarkers(state.markers, state.filters));
  const items = entries.flatMap((entry) => entry.items);

  if (!items.length) {
    alert('No return visits are available to add to Google Calendar.');
    return;
  }

  items.forEach((item) => {
    const url = createGoogleCalendarUrlForItem(item);
    if (url) {
      window.open(url, '_blank');
    }
  });
}

function queueGoogleCalendarEvent(visit, markerData) {
  if (!visit || !visit.returnDate) return;
  const url = createGoogleCalendarUrlForItem({
    title: markerData.title || 'Return visit',
    notes: visit.notes || '',
    contact: markerData.contact || '',
    outcome: markerData.outcome || '',
    visits: [visit],
  });
  if (url) window.open(url, '_blank');
}

function openGoogleCalendarForMarker(markerData) {
  const item = getCalendarEntries([markerData]).flatMap((entry) => entry.items)[0];
  if (!item) return;
  const url = createGoogleCalendarUrlForItem(item);
  if (url) window.open(url, '_blank');
}

function createGoogleCalendarUrlForItem(item) {
  const visit = (item.visits || [])[0];
  if (!visit || !visit.returnDate) return '';

  const title = item.title || 'Return visit';
  const details = [item.notes || '', `Outcome: ${item.outcome || 'None'}`, `Contact: ${item.contact || 'Unknown'}`]
    .filter(Boolean)
    .join('\n');
  const location = item.title || '';
  const start = formatGoogleDateTime(item.visits[0].returnDate);
  const end = formatGoogleDateTime(addMinutesToDate(item.visits[0].returnDate, 60));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  if (!start || !end) return '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details,
    location,
    ctz: timezone,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatGoogleDateTime(dateTime) {
  const dt = new Date(dateTime);
  if (Number.isNaN(dt.getTime())) return '';

  const pad = (value) => String(value).padStart(2, '0');
  const year = dt.getFullYear();
  const month = pad(dt.getMonth() + 1);
  const day = pad(dt.getDate());
  const hour = pad(dt.getHours());
  const minute = pad(dt.getMinutes());
  const second = pad(dt.getSeconds());

  return `${year}${month}${day}T${hour}${minute}${second}`;
}

function addMinutesToDate(dateTime, minutes) {
  const dt = new Date(dateTime);
  dt.setMinutes(dt.getMinutes() + minutes);
  return dt.toISOString();
}

function handleCalendarTouchStart(event) {
  state.calendarTouchStartY = event.touches?.[0]?.clientY ?? null;
}

function handleCalendarTouchEnd(event) {
  if (state.calendarTouchStartY === null) return;
  const endY = event.changedTouches?.[0]?.clientY ?? null;
  if (endY === null) return;

  const deltaY = state.calendarTouchStartY - endY;
  if (deltaY < -50) {
    state.calendarCollapsed = true;
  } else if (deltaY > 50) {
    state.calendarCollapsed = false;
  }

  state.calendarTouchStartY = null;
  updateCalendarPanelState();
}

function toggleCalendarPanel() {
  state.calendarCollapsed = !state.calendarCollapsed;
  updateCalendarPanelState();
}

function updateCalendarPanelState() {
  elems.calendarPanel.classList.toggle('collapsed', state.calendarCollapsed);
  elems.calendarToggleButton.textContent = state.calendarCollapsed ? 'Open' : 'Hide';
}

function renderCalendarPanel() {
  const entries = getCalendarEntries(getFilteredMarkers(state.markers, state.filters));
  const selectedDate = state.filters.returnDate;

  elems.calendarDayFilters.innerHTML = [
    `<button type="button" class="calendar-chip${selectedDate === 'all' ? ' active' : ''}" data-calendar-date="all">All days</button>`,
    ...entries.map((entry) => `<button type="button" class="calendar-chip${selectedDate === entry.date ? ' active' : ''}" data-calendar-date="${entry.date}">${escapeHtml(formatCalendarDate(entry.date))}</button>`),
  ].join('');

  if (!entries.length) {
    elems.calendarList.innerHTML = '<div class="calendar-empty">No return visits match this filter yet.</div>';
    return;
  }

  elems.calendarList.innerHTML = entries.map((entry) => `
    <div class="calendar-item">
      <div class="calendar-item__header">
        <strong>${escapeHtml(formatCalendarDate(entry.date))}</strong>
        <span>${entry.items.length} place${entry.items.length === 1 ? '' : 's'}</span>
      </div>
      ${entry.items.map((item) => `
        <div class="calendar-item__entry" data-marker-id="${item.marker.id}">
          <div class="calendar-item__summary">
            <strong>${escapeHtml(item.title || 'Pin')}</strong>
            <div>${escapeHtml(item.contact || 'No contact noted')}</div>
            <div class="calendar-item__notes">${escapeHtml(item.notes || 'No notes')}</div>
            <div class="calendar-item__time">${escapeHtml((item.visits || []).map((v) => formatTime(v.returnDate)).filter(Boolean).join(', '))}</div>
          </div>
          <div class="calendar-item__actions">
            <button type="button" class="calendar-item__action" data-action="return" data-marker-id="${item.marker.id}">Return</button>
            <button type="button" class="calendar-item__action" data-action="google" data-marker-id="${item.marker.id}">Google</button>
            <button type="button" class="calendar-item__action" data-action="edit" data-marker-id="${item.marker.id}">Edit</button>
            <button type="button" class="calendar-item__action calendar-item__action--danger" data-action="delete" data-marker-id="${item.marker.id}">Delete</button>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function formatTime(dateTime) {
  if (!dateTime) return '';
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) return dateTime;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatCalendarDate(dateValue) {
  if (!dateValue) return '';
  // If datetime string provided, parse directly
  const parsed = dateValue.includes('T') ? new Date(dateValue) : new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  // If time component present, show both date and time; otherwise show date only
  if (dateValue.includes('T')) {
    return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' });
  }
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function removeMarker(markerData) {
  if (markerData.leafletMarker) {
    state.map.removeLayer(markerData.leafletMarker);
  }

  state.markers = state.markers.filter((item) => item.id !== markerData.id);
  renderFilterOptions();
  renderMarkers();
  renderCalendarPanel();
  saveMarkers();
}

function saveMarkers() {
  const data = state.markers.map(({ id, lat, lng, title, contact, contactType, outcome, returnDate, notes, visits }) => ({ id, lat, lng, title, contact, contactType, outcome, returnDate, notes, visits }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadMarkers() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return;

  try {
    const parsed = JSON.parse(stored);
    state.markers = parsed.map((item) => ({
      id: item.id,
      lat: item.lat,
      lng: item.lng,
      title: item.title || 'Pin',
      contact: item.contact || '',
      contactType: item.contactType || '',
      outcome: item.outcome || '',
      returnDate: item.returnDate || '',
      notes: item.notes || '',
      visits: Array.isArray(item.visits) ? item.visits : (item.returnDate ? [{ id: crypto.randomUUID(), returnDate: item.returnDate, notes: item.notes || '' }] : []),
      leafletMarker: null,
    }));
  } catch (error) {
    console.error('Failed to parse stored markers', error);
    state.markers = [];
  }
}

window.addEventListener('DOMContentLoaded', initApp);
