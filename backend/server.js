import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 10000);
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false }) : null;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map(x => x.trim()) : true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', async (_req, res) => {
  if (!pool) return res.json({ ok: true, database: 'not-configured' });
  try { await pool.query('select 1'); res.json({ ok: true, database: 'connected' }); }
  catch (error) { res.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.get('/api', (_req, res) => res.json({ name: 'PG Management API', version: '1.0.0' }));

app.get('/api/guests', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Database is not configured' });
  try { const { rows } = await pool.query('select * from guests order by created_at desc'); res.json(rows); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Failed to load guests' }); }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Internal server error' }); });
app.listen(port, () => console.log(`PG Management API listening on ${port}`));
