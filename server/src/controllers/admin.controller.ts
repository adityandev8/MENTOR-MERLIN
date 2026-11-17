import type { Request, Response } from 'express';
import { getDashboardSummary } from '../services/dashboard.service.js';
import { listFrontDesk } from '../services/reservation.service.js';
import { frontDeskQuery } from '../validators/reservation.schemas.js';
import { parse } from '../validators/common.js';
import { sendOk, sendPage } from '../utils/http.js';
import { actorOf } from '../middleware/auth.js';

export async function dashboard(_req: Request, res: Response): Promise<void> {
  sendOk(res, await getDashboardSummary());
}

export async function frontDesk(req: Request, res: Response): Promise<void> {
  const { view, page, limit } = parse(frontDeskQuery, req.query);
  sendPage(res, await listFrontDesk(actorOf(req), view, { page, limit }));
}
