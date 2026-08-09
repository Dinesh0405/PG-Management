import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 10000);
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
      max: 10,
    })
  : null;

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map((value) => value.trim())
    : true,
}));
app.use(express.json({ limit: '2mb' }));

const requireDb = (res) => {
  if (!pool) {
    res.status(503).json({ error: 'Database is not configured' });
    return false;
  }
  return true;
};

const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

app.get('/health', asyncHandler(async (_req, res) => {
  if (!pool) return res.json({ ok: true, database: 'not-configured' });
  await pool.query('select 1');
  res.json({ ok: true, database: 'connected' });
}));

app.get('/api', (_req, res) => res.json({ name: 'PG Management API', version: '1.0.0' }));

// Guests
app.get('/api/guests', asyncHandler(async (_req, res) => {
  if (!requireDb(res)) return;
  const { rows } = await pool.query('select * from guests order by created_at desc');
  res.json(rows);
}));

app.post('/api/guests', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const {
    name, phone, email, dob, gender, id_type, id_number,
    emergency_contact_name, emergency_contact_phone, address, city,
    state, postal_code, room_id, bed_id, check_in, check_out, status,
    monthly_rent, security_deposit, advance_paid, photo_url, notes, created_by,
  } = req.body;

  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' });

  const { rows } = await pool.query(
    `insert into guests
      (name, phone, email, dob, gender, id_type, id_number,
       emergency_contact_name, emergency_contact_phone, address, city, state,
       postal_code, room_id, bed_id, check_in, check_out, status, monthly_rent,
       security_deposit, advance_paid, photo_url, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
             coalesce($18,'active'),coalesce($19,0),coalesce($20,0),coalesce($21,0),$22,$23,$24)
     returning *`,
    [name, phone, email || null, dob || null, gender || null, id_type || null,
      id_number || null, emergency_contact_name || null, emergency_contact_phone || null,
      address || null, city || null, state || null, postal_code || null,
      room_id || null, bed_id || null, check_in || null, check_out || null,
      status || 'active', monthly_rent, security_deposit, advance_paid,
      photo_url || null, notes || null, created_by || null]
  );
  res.status(201).json(rows[0]);
}));

app.get('/api/guests/:id', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { rows } = await pool.query('select * from guests where id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Guest not found' });
  res.json(rows[0]);
}));

app.put('/api/guests/:id', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const fields = ['name','phone','email','dob','gender','id_type','id_number','emergency_contact_name','emergency_contact_phone','address','city','state','postal_code','room_id','bed_id','check_in','check_out','status','monthly_rent','security_deposit','advance_paid','photo_url','notes'];
  const updates = fields.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  const values = updates.map((field) => req.body[field] === '' ? null : req.body[field]);
  const setClause = updates.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const { rows } = await pool.query(`update guests set ${setClause} where id = $${values.length + 1} returning *`, [...values, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Guest not found' });
  res.json(rows[0]);
}));

app.delete('/api/guests/:id', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const result = await pool.query('delete from guests where id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Guest not found' });
  res.status(204).send();
}));

// Rooms
app.get('/api/rooms', asyncHandler(async (_req, res) => {
  if (!requireDb(res)) return;
  const { rows } = await pool.query('select * from rooms order by room_number');
  res.json(rows);
}));

app.post('/api/rooms', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { room_number, floor, room_type, monthly_rent, security_deposit, capacity, status, notes } = req.body;
  if (!room_number) return res.status(400).json({ error: 'room_number is required' });
  const { rows } = await pool.query(
    `insert into rooms (room_number,floor,room_type,monthly_rent,security_deposit,capacity,status,notes)
     values ($1,$2,$3,coalesce($4,0),coalesce($5,0),coalesce($6,1),coalesce($7,'active'),$8) returning *`,
    [room_number, floor || null, room_type || null, monthly_rent, security_deposit, capacity, status, notes || null]
  );
  res.status(201).json(rows[0]);
}));

app.get('/api/rooms/:id/beds', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { rows } = await pool.query('select * from beds where room_id = $1 order by bed_number', [req.params.id]);
  res.json(rows);
}));

// Beds
app.post('/api/beds', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { room_id, bed_number, status, monthly_rent } = req.body;
  if (!room_id || !bed_number) return res.status(400).json({ error: 'room_id and bed_number are required' });
  const { rows } = await pool.query(
    `insert into beds (room_id,bed_number,status,monthly_rent)
     values ($1,$2,coalesce($3,'available'),coalesce($4,0)) returning *`,
    [room_id, bed_number, status, monthly_rent]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/beds/:id', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const allowed = ['bed_number','status','monthly_rent'];
  const updates = allowed.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field));
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  const values = updates.map((field) => req.body[field]);
  const clause = updates.map((field, index) => `${field} = $${index + 1}`).join(', ');
  const { rows } = await pool.query(`update beds set ${clause} where id = $${values.length + 1} returning *`, [...values, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Bed not found' });
  res.json(rows[0]);
}));

// Payments
app.get('/api/payments', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { guest_id } = req.query;
  const params = guest_id ? [guest_id] : [];
  const where = guest_id ? 'where guest_id = $1' : '';
  const { rows } = await pool.query(`select * from payments ${where} order by payment_date desc, created_at desc`, params);
  res.json(rows);
}));

app.post('/api/payments', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { guest_id, amount, payment_type, payment_method, payment_date, billing_month, transaction_reference, notes, received_by } = req.body;
  if (!guest_id || !amount || !payment_type) return res.status(400).json({ error: 'guest_id, amount and payment_type are required' });
  const { rows } = await pool.query(
    `insert into payments (guest_id,amount,payment_type,payment_method,payment_date,billing_month,transaction_reference,notes,received_by)
     values ($1,$2,$3,coalesce($4,'cash'),coalesce($5,current_date),$6,$7,$8,$9) returning *`,
    [guest_id, amount, payment_type, payment_method, payment_date || null, billing_month || null, transaction_reference || null, notes || null, received_by || null]
  );
  res.status(201).json(rows[0]);
}));

// Documents: metadata endpoint; actual file upload should use Supabase Storage.
app.get('/api/documents', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { guest_id } = req.query;
  const params = guest_id ? [guest_id] : [];
  const where = guest_id ? 'where guest_id = $1' : '';
  const { rows } = await pool.query(`select * from documents ${where} order by created_at desc`, params);
  res.json(rows);
}));

app.post('/api/documents', asyncHandler(async (req, res) => {
  if (!requireDb(res)) return;
  const { guest_id, document_type, document_number, file_name, file_url, mime_type, file_size, uploaded_by } = req.body;
  if (!guest_id || !document_type || !file_name || !file_url) return res.status(400).json({ error: 'guest_id, document_type, file_name and file_url are required' });
  const { rows } = await pool.query(
    `insert into documents (guest_id,document_type,document_number,file_name,file_url,mime_type,file_size,uploaded_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [guest_id, document_type, document_number || null, file_name, file_url, mime_type || null, file_size || null, uploaded_by || null]
  );
  res.status(201).json(rows[0]);
}));

// Dashboard
app.get('/api/dashboard', asyncHandler(async (_req, res) => {
  if (!requireDb(res)) return;
  const [guests, rooms, beds, payments] = await Promise.all([
    pool.query(`select count(*)::int as total, count(*) filter (where status='active')::int as active from guests`),
    pool.query(`select count(*)::int as total from rooms where status='active'`),
    pool.query(`select count(*)::int as total, count(*) filter (where status='occupied')::int as occupied, count(*) filter (where status='available')::int as available from beds`),
    pool.query(`select coalesce(sum(amount),0)::numeric as total from payments where payment_date >= date_trunc('month', current_date)`),
  ]);
  res.json({
    guests: guests.rows[0],
    rooms: rooms.rows[0],
    beds: beds.rows[0],
    current_month_collections: payments.rows[0].total,
  });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err?.code === '23505') return res.status(409).json({ error: 'A record with the same unique value already exists' });
  if (err?.code === '23503') return res.status(400).json({ error: 'Referenced record does not exist' });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => console.log(`PG Management API listening on ${port}`));
