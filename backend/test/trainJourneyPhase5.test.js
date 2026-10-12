import assert from 'node:assert/strict';
import test from 'node:test';

const { searchTrainOptions, estimateTransportPlan } = await import('../src/services/transportService.js');

test('reports unavailable train integration without inventing results', async () => {
  const previousUrl = process.env.TRAIN_SEARCH_API_URL;
  delete process.env.TRAIN_SEARCH_API_URL;
  const result = await searchTrainOptions({ from: 'Kolkata', to: 'Ranchi', date: '2099-10-12' });
  assert.equal(result.status, 'unavailable');
  assert.equal(result.dataClassification, 'unavailable');
  assert.deepEqual(result.results, []);
  assert.match(result.bookingUrl, /irctc\.co\.in/);
  if (previousUrl === undefined) delete process.env.TRAIN_SEARCH_API_URL;
  else process.env.TRAIN_SEARCH_API_URL = previousUrl;
});

test('keeps unverified train fares out of the transport estimate', async () => {
  const result = await estimateTransportPlan({
    startLocation: 'Ranchi',
    destinations: ['Netarhat'],
    mode: 'Train',
    travelers: 2,
    tripDate: '2099-10-12'
  });
  assert.equal(result.intercity[0].estimatedCostValue, 0);
  assert.equal(result.intercity[0].availabilityStatus, 'unavailable');
  assert.equal(result.intercity[0].bookingUrl, 'https://www.irctc.co.in/');
});

test('normalizes only train data returned by an authorized integration', async () => {
  const previousUrl = process.env.TRAIN_SEARCH_API_URL;
  const previousFetch = globalThis.fetch;
  process.env.TRAIN_SEARCH_API_URL = 'https://trains.example.test/search';
  globalThis.fetch = async () => new Response(JSON.stringify({
    results: [{
      trainName: 'Verified Express',
      trainNumber: '12345',
      origin: 'Kolkata',
      destination: 'Ranchi',
      departureTime: '08:00',
      arrivalTime: '14:00',
      duration: '6h',
      fare: 850,
      availability: 'AVAILABLE'
    }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await searchTrainOptions({
      from: 'Kolkata',
      to: 'Ranchi',
      date: '2099-10-12',
      passengers: { adults: 2 }
    });
    assert.equal(result.status, 'live');
    assert.equal(result.results[0].trainNumber, '12345');
    assert.equal(result.results[0].fare, 850);
    assert.equal(result.results[0].availability, 'AVAILABLE');
  } finally {
    if (previousUrl === undefined) delete process.env.TRAIN_SEARCH_API_URL;
    else process.env.TRAIN_SEARCH_API_URL = previousUrl;
    globalThis.fetch = previousFetch;
  }
});

test('rejects invalid train travel dates', async () => {
  await assert.rejects(
    () => searchTrainOptions({ from: 'Kolkata', to: 'Ranchi', date: '2099-02-31' }),
    /valid YYYY-MM-DD/
  );
});

test('does not label local sightseeing as train transport', async () => {
  const result = await estimateTransportPlan({
    startLocation: 'Ranchi',
    destinations: ['Netarhat'],
    mode: 'Train',
    travelers: 2,
    tripDate: '2099-10-12'
  });
  assert.equal(result.selectedMode, 'Train');
  assert.equal(result.localTransport[0].mode, 'Private Car');
  assert.match(result.localTransport[0].notes, /intercity train travel is shown separately/);
});
