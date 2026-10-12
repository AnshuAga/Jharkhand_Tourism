import assert from 'node:assert/strict';
import test from 'node:test';
import { getProfileInterests } from '../src/utils/profileInterests.js';

test('destination profile interests match the authenticated profile API response', () => {
  const response = {
    success: true,
    tourist: {
      preferences: {
        interests: ['Nature', 'Waterfall']
      }
    }
  };

  assert.deepEqual(getProfileInterests(response), ['Nature', 'Waterfall']);
});

test('profile interest parsing preserves photography and does not add defaults', () => {
  assert.deepEqual(
    getProfileInterests({ tourist: { preferences: { interests: '["Photography"]' } } }),
    ['Photography']
  );
  assert.deepEqual(getProfileInterests({ tourist: { preferences: { interests: [] } } }), []);
});
