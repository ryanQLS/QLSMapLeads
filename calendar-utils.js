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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    canHaveReturnDate,
    getFilteredMarkers,
    getReturnDateOptions,
    getCalendarEntries,
  };
}
