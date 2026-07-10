const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Datos y categorías por defecto (mismos valores que traía la app originalmente).
// Solo se usan para "sembrar" la base de datos la primera vez que arranca, vacía.
const DEFAULT_CAT_NAMES = { A: 'CONSTRUCCIÓN Y EQ.', B: 'RECURSOS HUMANOS', C: 'CAPITAL TRABAJO', D: 'MARKETING', E: 'CAPACITACIÓN' };
const DEFAULT_CAT_COLORS = { A: '#10b981', B: '#ef4444', C: '#f59e0b', D: '#06b6d4', E: '#8b5cf6', _: '#5c5e72' };
const ZERO_MONTHS = { Enero: 0, Febrero: 0, Marzo: 0, Abril: 0, Mayo: 0, Junio: 0, Julio: 0, Agosto: 0, Septiembre: 0, Octubre: 0, Noviembre: 0, Diciembre: 0 };
const ORIGINAL_ITEMS = [
  { id: 'i001', cat: 'A', name: 'Tablet', budget: 4000, months: { ...ZERO_MONTHS } },
  { id: 'i002', cat: 'A', name: 'Proyector', budget: 8000, months: { ...ZERO_MONTHS } },
  { id: 'i003', cat: 'A', name: 'Sistema contable', budget: 5300, months: { ...ZERO_MONTHS } },
  { id: 'i018', cat: 'B', name: 'Gerente General', budget: 20000, months: { ...ZERO_MONTHS, Mayo: 10000 } },
  { id: 'i019', cat: 'B', name: 'Gestor Admin', budget: 16000, months: { ...ZERO_MONTHS, Mayo: 8000 } },
  { id: 'i025', cat: 'B', name: 'Alquileres', budget: 8000, months: { ...ZERO_MONTHS, Mayo: 4000, Junio: 2000 } },
  { id: 'i029', cat: 'D', name: 'Prototipado', budget: 3500, months: { ...ZERO_MONTHS } },
  { id: 'i038', cat: 'E', name: 'Reuniones Consejo', budget: 500, months: { ...ZERO_MONTHS, Mayo: 38, Junio: 48 } }
];

async function waitForDb(retries = 30, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('Conectado a la base de datos.');
      return;
    } catch (err) {
      console.log(`Esperando la base de datos... intento ${i + 1}/${retries}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('No se pudo conectar a la base de datos después de varios intentos.');
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INT PRIMARY KEY,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      cat_names JSONB NOT NULL DEFAULT '{}'::jsonb,
      cat_colors JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  const { rows } = await pool.query('SELECT id FROM app_state WHERE id = 1');
  if (rows.length === 0) {
    await pool.query(
      'INSERT INTO app_state (id, items, cat_names, cat_colors) VALUES (1, $1, $2, $3)',
      [JSON.stringify(ORIGINAL_ITEMS), JSON.stringify(DEFAULT_CAT_NAMES), JSON.stringify(DEFAULT_CAT_COLORS)]
    );
    console.log('Base de datos vacía: se cargaron los datos iniciales de ejemplo.');
  }
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/state', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT items, cat_names, cat_colors, updated_at FROM app_state WHERE id = 1');
    if (rows.length === 0) return res.status(404).json({ error: 'Sin estado guardado.' });
    const r = rows[0];
    res.json({ items: r.items, catNames: r.cat_names, catColors: r.cat_colors, updatedAt: r.updated_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

app.put('/api/state', async (req, res) => {
  try {
    const { items, catNames, catColors } = req.body || {};
    if (!Array.isArray(items)) return res.status(400).json({ error: '"items" debe ser un arreglo.' });
    await pool.query(
      'UPDATE app_state SET items = $1, cat_names = $2, cat_colors = $3, updated_at = now() WHERE id = 1',
      [JSON.stringify(items), JSON.stringify(catNames || {}), JSON.stringify(catColors || {})]
    );
    res.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// Frontend estático (el archivo index.html con toda la app)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function start() {
  await waitForDb();
  await initDb();
  app.listen(PORT, () => console.log(`Servidor de Presupuesto escuchando en el puerto ${PORT}`));
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});
