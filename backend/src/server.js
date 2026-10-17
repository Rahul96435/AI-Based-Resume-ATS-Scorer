import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { pool, initializeDatabase } from './db.js';
import { authenticate } from './middleware/auth.js';
import { extractResumeText } from './services/extractText.js';
import { createReport } from './services/report.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.use(cors({ origin: config.clientUrl, credentials: false }));
app.use(express.json({ limit: '2mb' }));

const tokenFor = (user) => jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
const userResponse = (user) => ({ token: tokenFor(user), user: { id: user.id, email: user.email } });
const databaseConfigured = (_req, res, next) => config.databaseUrl
  ? next()
  : res.status(503).json({ error: 'PostgreSQL is not configured. Copy backend/.env.example to backend/.env and set DATABASE_URL.' });

app.get('/api/v1/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected', runtime: 'Node.js' });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'unavailable' });
  }
});

app.post('/api/v1/auth/register', databaseConfigured, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, passwordHash]);
    res.status(201).json(userResponse(rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account already exists for this email.' });
    next(error);
  }
});

app.post('/api/v1/auth/login', databaseConfigured, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { rows } = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    res.json(userResponse(user));
  } catch (error) { next(error); }
});

app.post('/api/v1/analyze-resume', databaseConfigured, authenticate, upload.single('resume'), async (req, res, next) => {
  try {
    const resumeText = await extractResumeText(req.file);
    if (!resumeText.trim()) return res.status(422).json({ error: 'No readable text was found in this resume.' });
    let modelResponse;
    try {
      modelResponse = await fetch(`${config.modelServiceUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: String(req.body.job_description || ''),
        }),
      });
    } catch {
      return res.status(502).json({ error: 'The ATS model service is unavailable. Start model-service on port 8001.' });
    }
    const modelBody = await modelResponse.json().catch(() => ({}));
    if (!modelResponse.ok) {
      return res.status(502).json({ error: modelBody.detail || 'The ATS model service is unavailable.' });
    }
    const result = modelBody;
    await pool.query('INSERT INTO analyses (user_id, filename, result) VALUES ($1, $2, $3)', [req.user.sub, req.file.originalname, result]);
    res.json(result);
  } catch (error) { next(error); }
});

app.get('/api/v1/history', databaseConfigured, authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, filename, result AS analysis_result, created_at FROM analyses WHERE user_id = $1 ORDER BY created_at DESC', [req.user.sub]);
    res.json(rows);
  } catch (error) { next(error); }
});

app.delete('/api/v1/history/:analysisId', databaseConfigured, authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM analyses WHERE id = $1 AND user_id = $2', [req.params.analysisId, req.user.sub]);
    if (!result.rowCount) return res.status(404).json({ error: 'Analysis not found.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/v1/history/:analysisId/pdf', databaseConfigured, authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, filename, result FROM analyses WHERE id = $1 AND user_id = $2', [req.params.analysisId, req.user.sub]);
    if (!rows[0]) return res.status(404).json({ error: 'Analysis not found.' });
    const pdf = await createReport(rows[0].result);
    res.type('application/pdf').attachment(`ats_report_${rows[0].id}.pdf`).send(pdf);
  } catch (error) { next(error); }
});

app.post('/api/v1/generate-pdf', databaseConfigured, authenticate, async (req, res, next) => {
  try {
    const pdf = await createReport(req.body);
    res.type('application/pdf').attachment('ats_report.pdf').send(pdf);
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  const status = error instanceof multer.MulterError ? 400 : 422;
  res.status(status).json({ error: error.message || 'Request could not be completed.' });
});

try {
  await initializeDatabase();
  app.listen(config.port, () => console.log(`ATS API listening on http://localhost:${config.port}`));
} catch (error) {
  console.error(`PostgreSQL is unavailable: ${error.message}`);
  await pool.end();
  process.exitCode = 1;
}
