import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';

const databasePath = path.join(os.tmpdir(), `jharkhand-transport-${process.pid}.db`);
process.env.SQLITE_DB_PATH = databasePath;

const { db, sqlite } = await import('../src/database/db.js');
const { geoTransportService } = await import('../src/services/geoTransportService.js');

db.transport.updateTelemetry({
  vehicleId: 'telemetry-test-1',
  name: 'Telemetry Test Vehicle',
  plate: 'JH-TEST-01',
  route: 'Ranchi Test Route',
  lat: 23.34,
  lng: 85.31,
  speed_kmh: 20,
  status: 'active'
});

test('live and demo status endpoints expose the same vehicle inventory', () => {
  const liveVehicles = geoTransportService.getLiveVehicles();
  const statusVehicles = geoTransportService.getDemoStatus().vehicles;

  assert.equal(liveVehicles.length, 4);
  assert.equal(statusVehicles.length, 4);
  assert.deepEqual(
    statusVehicles.map(vehicle => vehicle.id).sort(),
    liveVehicles.map(vehicle => vehicle.id).sort()
  );
  assert.ok(statusVehicles.some(vehicle => vehicle.id === 'telemetry-test-1'));
});

after(() => {
  sqlite.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = `${databasePath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
});
