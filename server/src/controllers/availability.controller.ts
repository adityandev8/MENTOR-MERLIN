import type { Request, Response } from 'express';
import * as availabilityService from '../services/availability.service.js';
import { availabilityQuerySchema } from '../validators/reservation.schemas.js';
import { parse } from '../validators/common.js';
import { sendPage } from '../utils/http.js';

export async function search(req: Request, res: Response): Promise<void> {
  const { page, limit, ...stay } = parse(availabilityQuerySchema, req.query);
  sendPage(res, await availabilityService.searchAvailability(stay, { page, limit }));
}
