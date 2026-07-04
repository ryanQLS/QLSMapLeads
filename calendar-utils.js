function canHaveReturnDate(outcome) {
  return Boolean(outcome) && outcome !== 'Not Interested';
}

function hasReturnDate(marker, date) {
  const dates = [marker.returnDate, ...(marker.visits || []).map((visit) => visit.returnDate)].filter(Boolean).map((d) => (d || '').split && d.split('T')[0] || d);
  return dates.includes(date);
}

function hasAnyReturnDate(marker) {
  return Boolean((marker.returnDate && marker.returnDate.split && marker.returnDate.split('T')[0]) || (marker.visits || []).some((visit) => visit.returnDate));
}

function getFilteredMarkers(markers, filters = {}) {
  const outcomeFilter = (filters.outcome || 'all').trim();
  const returnDateFilter = (filters.returnDate || 'all').trim();

  return markers.filter((marker) => {
    const outcomeMatch = outcomeFilter === 'all' || marker.outcome === outcomeFilter;
    const returnDateMatch =
      returnDateFilter === 'all' ||
      (returnDateFilter === 'has-return-date' ? hasAnyReturnDate(marker) : hasReturnDate(marker, returnDateFilter));

    return outcomeMatch && returnDateMatch;
  });
}

function getReturnDateOptions(markers) {
  const dates = markers.flatMap((marker) => [marker.returnDate, ...(marker.visits || []).map((visit) => visit.returnDate)]).filter(Boolean).map((d) => (d || '').split && d.split('T')[0] || d);
  return [...new Set(dates)].sort();
}

function getCalendarEntries(markers) {
  // Group visits by returnDate, then by marker id so a single pin appears once per day
  const dateMap = new Map();

  markers.forEach((marker) => {
    const visits = (marker.visits || []).filter((visit) => visit.returnDate);
    visits.forEach((visit) => {
      const date = (visit.returnDate || '').split('T')[0] || visit.returnDate;
      if (!dateMap.has(date)) dateMap.set(date, new Map());

      const markerMap = dateMap.get(date);
      if (!markerMap.has(marker.id)) {
        markerMap.set(marker.id, {
          marker,
          visits: [visit],
          title: marker.title,
          contact: marker.contact,
          outcome: marker.outcome,
        });
      } else {
        markerMap.get(marker.id).visits.push(visit);
      }
    });
  });

  const entries = Array.from(dateMap.entries()).map(([date, markerMap]) => ({
    date,
    items: Array.from(markerMap.values()).map((item) => ({
      ...item,
      notes: item.visits.map((v) => v.notes).filter(Boolean).join(' | '),
      createdAt: (item.visits[0] && item.visits[0].createdAt) || (item.visits[0] && (item.visits[0].returnDate || '').split('T')[0]) || date,
    })),
  }));

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

function syncMarkerReturnDate(markerData, options = {}) {
  const returnDate = String(options.returnDate || '').trim();
  const notes = options.notes || '';
  const visitId = options.visitId || null;
  const isReturnMode = Boolean(options.isReturnMode);

  markerData.returnDate = returnDate;

  if (!Array.isArray(markerData.visits)) {
    markerData.visits = [];
  }

  if (!returnDate) {
    if (visitId) {
      markerData.visits = markerData.visits.filter((visit) => visit.id !== visitId);
    } else {
      markerData.visits = markerData.visits.filter((visit) => !visit.returnDate);
    }
    return markerData;
  }

  if (visitId) {
    const visitData = markerData.visits.find((visit) => visit.id === visitId);
    if (visitData) {
      visitData.returnDate = returnDate;
      visitData.notes = notes;
    } else {
      markerData.visits.push({
        id: visitId,
        returnDate,
        createdAt: new Date().toISOString().slice(0, 10),
        notes,
      });
    }
    return markerData;
  }

  const existingVisit = markerData.visits.find((visit) => visit.returnDate);
  if (existingVisit) {
    existingVisit.returnDate = returnDate;
    existingVisit.notes = notes;
    existingVisit.createdAt = existingVisit.createdAt || new Date().toISOString().slice(0, 10);
    return markerData;
  }

  if (isReturnMode) {
    markerData.visits = markerData.visits.filter((visit) => !visit.returnDate);
  }

  markerData.visits.push({
    id: crypto.randomUUID(),
    returnDate,
    createdAt: new Date().toISOString().slice(0, 10),
    notes,
  });

  return markerData;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    canHaveReturnDate,
    getFilteredMarkers,
    getReturnDateOptions,
    getCalendarEntries,
    syncMarkerReturnDate,
  };
}
