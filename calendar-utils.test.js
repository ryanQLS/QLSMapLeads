const test = require('node:test');
const assert = require('node:assert/strict');
const { canHaveReturnDate, getFilteredMarkers, getReturnDateOptions, getCalendarEntries, syncMarkerReturnDate } = require('./calendar-utils');

test('filters markers by outcome and return date', () => {
  const markers = [
    { id: '1', title: 'Alpha', outcome: 'Follow Up', returnDate: '2026-07-10' },
    { id: '2', title: 'Beta', outcome: 'Closed Deal', returnDate: '2026-07-10' },
    { id: '3', title: 'Gamma', outcome: 'Door Locked', returnDate: '' },
  ];

  assert.deepEqual(
    getFilteredMarkers(markers, { outcome: 'Follow Up', returnDate: '2026-07-10' }).map((marker) => marker.id),
    ['1'],
  );

  assert.deepEqual(
    getFilteredMarkers(markers, { outcome: 'all', returnDate: '2026-07-10' }).map((marker) => marker.id),
    ['1', '2'],
  );
});

test('decides when a return date is supported', () => {
  assert.equal(canHaveReturnDate('Follow Up'), true);
  assert.equal(canHaveReturnDate('Closed Deal'), true);
  assert.equal(canHaveReturnDate('Not Interested'), false);
  assert.equal(canHaveReturnDate(''), false);
});

test('collects unique return date options and calendar groups', () => {
  const markers = [
    { id: '1', title: 'Alpha', outcome: 'Follow Up', returnDate: '2026-07-10' },
    { id: '2', title: 'Beta', outcome: 'Follow Up', returnDate: '2026-07-10' },
    { id: '3', title: 'Gamma', outcome: 'Closed Deal', returnDate: '2026-07-12' },
  ];

  assert.deepEqual(getReturnDateOptions(markers), ['2026-07-10', '2026-07-12']);
  assert.deepEqual(getCalendarEntries(markers).map((entry) => entry.date), ['2026-07-10', '2026-07-12']);
});

test('uses visit records when grouping calendar entries', () => {
  const markers = [{
    id: '1',
    title: 'Alpha',
    outcome: 'Follow Up',
    visits: [{ id: 'v1', returnDate: '2026-07-10', notes: 'First visit' }],
  }];

  const entries = getCalendarEntries(markers);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].items[0].notes, 'First visit');
});

test('removes a cleared return date from the marker and its visit record', () => {
  const marker = {
    id: '1',
    title: 'Alpha',
    outcome: 'Follow Up',
    returnDate: '2026-07-10',
    visits: [{ id: 'v1', returnDate: '2026-07-10', notes: 'First visit' }],
  };

  syncMarkerReturnDate(marker, { returnDate: '', notes: '', visitId: 'v1' });

  assert.equal(marker.returnDate, '');
  assert.deepEqual(marker.visits, []);
});

test('creates a visit record when an existing marker gains a return date', () => {
  const marker = {
    id: '1',
    title: 'Alpha',
    outcome: 'Follow Up',
    returnDate: '',
    visits: [],
  };

  syncMarkerReturnDate(marker, { returnDate: '2026-07-10', notes: 'Follow up', visitId: null, isReturnMode: false });

  assert.equal(marker.returnDate, '2026-07-10');
  assert.equal(marker.visits.length, 1);
  assert.equal(marker.visits[0].returnDate, '2026-07-10');
});
