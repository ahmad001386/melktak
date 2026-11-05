import { Router } from 'express';
import { postgresDb } from '../../db/postgres.js';
const healthRouter = Router();
healthRouter.get(['/', '/db'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await postgresDb.init();
    await postgresDb.pg.query('SELECT 1');
    return res.json({ status: 'healthy', database: { status: 'connected' }, timestamp: new Date().toISOString() });
  } catch {
    return res.status(503).json({ status: 'unhealthy', database: { status: 'unavailable' } });
  }
});
export { healthRouter };
 