import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { catalog } from './src/catalog.js';
import { searchRecipesByIngredients, searchIngredients } from './src/matching.js';

dotenv.config();

// Secrets management: generate ephemeral secret if missing and log warning
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn(
    '[SECURITY WARNING] JWT_SECRET is not set in environment or Secrets panel. Generated a random ephemeral secret for this session.'
  );
}

// Fail loudly on boot if catalog is incomplete
if (!catalog.stats.isHealthy) {
  const fatalMsg = catalog.stats.errorMessage || '[FATAL ERROR] Incomplete catalog. Boot halted.';
  console.error(fatalMsg);
  throw new Error(fatalMsg);
}

const app = express();
// Cloud Run sets PORT=8080 for NGINX. The applet container expects user web app on 3000.
const PORT = (process.env.PORT && process.env.PORT !== '8080') ? Number(process.env.PORT) : 3000;
const HOST = '0.0.0.0';

// Security headers with Helmet - configured for iframe preview compatibility
app.use(
  helmet({
    frameguard: false, // allow iframe preview inside AI Studio
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Step 2: Health check returning real catalog counts and unresolved count
app.get('/api/health', (req, res) => {
  if (!catalog.stats.isHealthy) {
    return res.status(500).json({
      ok: false,
      error: catalog.stats.errorMessage || 'Catalog incomplete',
      recipes: catalog.stats.loadedRecipes,
      ingredients: catalog.stats.loadedIngredients,
      unresolved: catalog.stats.unresolved
    });
  }

  res.json({
    ok: true,
    store: 'memory',
    recipes: catalog.stats.loadedRecipes,
    ingredients: catalog.stats.loadedIngredients,
    auto_resolved: catalog.stats.autoResolved,
    unresolved: catalog.stats.unresolved
  });
});

// Step 2: GET /api/recipes?q=&cat= returning card fields (id, name, local, cat, lvl, time, e, c)
app.get('/api/recipes', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const cat = typeof req.query.cat === 'string' ? req.query.cat : undefined;
  const cards = catalog.getCards(q, cat);
  res.json(cards);
});

// Step 4: GET /api/recipes/:id returns card fields + desc, serves, items[], steps[],
// nutrition_total, nutrition_per_serving, nutrition_source, nutrition_gaps[]. 404 for unknown id.
app.get('/api/recipes/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid recipe ID' });
  }
  const r = catalog.getRecipeById(id);
  if (!r) {
    return res.status(404).json({ error: 'Recipe not found' });
  }
  res.json({
    id: r.id,
    name: r.name,
    local: r.local,
    cat: r.cat,
    lvl: r.lvl,
    time: r.time,
    e: r.e,
    c: r.c,
    kcal: r.kcal,
    desc: r.desc,
    serves: r.serves,
    items: r.items,
    steps: r.steps,
    nutrition_total: r.nutrition_total,
    nutrition_per_serving: r.nutrition_per_serving,
    nutrition_source: r.nutrition_source,
    nutrition_gaps: r.nutrition_gaps
  });
});

// Step 3: POST /api/recipes/search-by-ingredients
app.post('/api/recipes/search-by-ingredients', (req, res) => {
  const { ingredients, cat, match } = req.body || {};
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'Ingredients array is required and must not be empty' });
  }

  try {
    const results = searchRecipesByIngredients(ingredients, { cat, match });
    res.json(results);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Search failed' });
  }
});

// Step 3: Ingredients catalog endpoint with query search support
app.get('/api/ingredients', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const list = searchIngredients(q);
  res.json(list);
});

// Vite in middleware mode inside Express (one process, one port)
async function setupFrontend() {
  try {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('[KainTayo Server] Vite middleware mode mounted inside Express');
  } catch (err) {
    console.warn('[KainTayo Server] Vite middleware initialization fallback to static:', err);
    const rootPath = process.cwd();
    app.use(express.static(rootPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(rootPath, 'index.html'));
    });
  }
}

await setupFrontend();

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[KainTayo Server] Running on http://${HOST}:${PORT}`);
});

export { app, server, JWT_SECRET };
