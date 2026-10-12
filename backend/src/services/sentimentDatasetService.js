import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const datasetPath = path.resolve(__dirname, '../data/jharkhand_tourism_sentiment_dataset.jsonl');
const allowedOverallLabels = new Set(['positive', 'negative', 'neutral', 'mixed']);
const requiredFields = ['sample_id', 'text', 'language', 'overall_sentiment', 'aspect', 'aspect_sentiment', 'entity_type'];

let cachedDataset;
let datasetErrors = [];

function validateRow(row, lineNumber, seenIds) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error(`Synthetic sentiment dataset line ${lineNumber} is not an object.`);
  }
  requiredFields.forEach((field) => {
    if (typeof row[field] !== 'string' || !row[field].trim()) {
      throw new Error(`Synthetic sentiment dataset line ${lineNumber} is missing '${field}'.`);
    }
  });
  if (seenIds.has(row.sample_id)) {
    throw new Error(`Synthetic sentiment dataset contains duplicate sample_id '${row.sample_id}'.`);
  }
  if (!allowedOverallLabels.has(row.overall_sentiment)) {
    throw new Error(`Synthetic sentiment dataset line ${lineNumber} has an unsupported overall_sentiment.`);
  }
  if (row.is_synthetic !== true) {
    throw new Error(`Synthetic sentiment dataset line ${lineNumber} is not marked is_synthetic=true.`);
  }
  seenIds.add(row.sample_id);
  return Object.freeze({ ...row });
}

export const sentimentDatasetService = {
  load() {
    if (cachedDataset) return cachedDataset;
    if (!fs.existsSync(datasetPath)) {
      datasetErrors = [`Synthetic sentiment dataset not found at ${datasetPath}.`];
      cachedDataset = Object.freeze([]);
      return cachedDataset;
    }

    const lines = fs.readFileSync(datasetPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    const rows = [];
    datasetErrors = [];
    lines.forEach((line, index) => {
        try {
          rows.push(JSON.parse(line));
        } catch (error) {
          datasetErrors.push(`Line ${index + 1} is invalid JSON: ${error.message}`);
        }
    });
    const seenIds = new Set();
    cachedDataset = Object.freeze(rows.flatMap((row, index) => {
      try {
        return [validateRow(row, index + 1, seenIds)];
      } catch (error) {
        datasetErrors.push(error.message);
        return [];
      }
    }));
    return cachedDataset;
  },

  getMetadata() {
    const rows = this.load();
    return {
      available: fs.existsSync(datasetPath),
      sourceFormat: 'jsonl',
      rowCount: rows.length,
      sampleIds: rows.map(row => row.sample_id),
      languages: [...new Set(rows.map(row => row.language))],
      overallLabels: [...new Set(rows.map(row => row.overall_sentiment))],
      isSynthetic: true,
      usedAsRealReviews: false,
      usedForModelTraining: false,
      errors: datasetErrors,
      note: 'Synthetic development and demonstration data. It is not customer feedback, rating evidence, or recommendation input.'
    };
  },
  getSamples(sampleId) {
    const rows = this.load();
    return sampleId ? rows.filter(row => row.sample_id === sampleId) : rows;
  }
};
