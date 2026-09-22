import { db, sqlite } from './db.js';
import { additionalDestinations } from './additionalDestinations.js';

for (const destination of additionalDestinations) {
  const existing = db.destinations.findById(destination.id);
  if (existing) {
    db.destinations.update(destination.id, destination);
  } else {
    db.destinations.create(destination);
  }
}

console.log(`Seeded ${additionalDestinations.length} additional destinations.`);
sqlite.close();
