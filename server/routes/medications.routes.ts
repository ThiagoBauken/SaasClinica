import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authCheck, asyncHandler } from '../middleware/auth';

import { logger } from '../logger';
const router = Router();

// ESM-safe __dirname (this file is loaded as an ES module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Load the medications dataset once on startup to avoid repeated disk reads.
// The JSON file lives alongside the server source tree under server/data/.
// ---------------------------------------------------------------------------

interface MedicationPresentation {
  dosage: string;
  form: 'comprimido' | 'capsula' | 'solucao' | 'pomada' | 'gel';
  defaultPosology: string;
}

interface Medication {
  id: number;
  name: string;
  category:
    | 'antibiotico'
    | 'anti-inflamatorio'
    | 'analgesico'
    | 'anestesico'
    | 'antifungico'
    | 'corticoide'
    | 'antisseptico'
    | 'outros';
  contraindications: string;
  presentations: MedicationPresentation[];
}

const DATA_PATH = path.resolve(__dirname, '../data/medications.json');

let medicationsCache: Medication[] = [];

try {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  medicationsCache = JSON.parse(raw) as Medication[];
} catch (err) {
  // Non-fatal: log the error but allow the server to start. Endpoints will
  // return empty results rather than crashing the process.
  logger.error({ err: err }, '[medications] Failed to load medications.json:');
}

// ---------------------------------------------------------------------------
// GET /api/v1/medications/categories
// Returns the sorted list of unique category values present in the dataset.
// Placed before the /:id-style wildcard to avoid route shadowing.
// ---------------------------------------------------------------------------

router.get(
  '/categories',
  authCheck,
  asyncHandler(async (_req, res) => {
    const categories = Array.from(
      new Set(medicationsCache.map((m) => m.category))
    ).sort();

    res.json({ data: categories });
  })
);

// ---------------------------------------------------------------------------
// GET /api/v1/medications/search?q=<term>&category=<category>
// Case-insensitive prefix/substring match on the medication name.
// Optional `category` query param narrows results to a single category.
// Returns at most 10 results for autocomplete performance.
// ---------------------------------------------------------------------------

router.get(
  '/search',
  authCheck,
  asyncHandler(async (req, res) => {
    const raw = req.query.q;
    const categoryFilter = req.query.category as string | undefined;

    if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
      return res
        .status(400)
        .json({ error: 'Query parameter "q" is required and must be a non-empty string.' });
    }

    const term = raw.trim().toLowerCase();

    let results = medicationsCache.filter((m) =>
      m.name.toLowerCase().includes(term)
    );

    if (categoryFilter) {
      results = results.filter((m) => m.category === categoryFilter);
    }

    // Rank exact-start matches above interior matches for a better UX.
    results.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(term) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(term) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    res.json({ data: results.slice(0, 10) });
  })
);

// ---------------------------------------------------------------------------
// GET /api/v1/medications?page=1&limit=20&category=<category>
// Paginated listing of all medications.
// Optional `category` query param filters by category.
// ---------------------------------------------------------------------------

router.get(
  '/',
  authCheck,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit as string) || '20', 10))
    );
    const categoryFilter = req.query.category as string | undefined;

    let items = medicationsCache;

    if (categoryFilter) {
      items = items.filter((m) => m.category === categoryFilter);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const data = items.slice(offset, offset + limit);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  })
);

export default router;
