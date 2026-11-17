import type { Request, Response } from 'express';
import * as roomTypeService from '../services/roomType.service.js';
import * as availabilityService from '../services/availability.service.js';
import { createRoomTypeSchema, listRoomTypesQuery, updateRoomTypeSchema } from '../validators/roomType.schemas.js';
import { stayQuerySchema } from '../validators/reservation.schemas.js';
import { parse } from '../validators/common.js';
import { sendOk, sendPage } from '../utils/http.js';
import { isStaff } from '../domain/lifecycle.js';

function viewerIsStaff(req: Request): boolean {
  return !!req.auth && isStaff(req.auth.role);
}

function idParam(req: Request): string {
  return String(req.params.id ?? '');
}

export async function list(req: Request, res: Response): Promise<void> {
  const q = parse(listRoomTypesQuery, req.query);
  // Inactive room types are only visible to staff, regardless of what the query asks for.
  const page = await roomTypeService.listRoomTypes({ ...q, includeInactive: q.includeInactive && viewerIsStaff(req) });
  sendPage(res, page);
}

export async function getById(req: Request, res: Response): Promise<void> {
  sendOk(res, await roomTypeService.getRoomType(idParam(req), { includeInactive: viewerIsStaff(req) }));
}

export async function quote(req: Request, res: Response): Promise<void> {
  const q = parse(stayQuerySchema, req.query);
  sendOk(res, await availabilityService.getQuote(idParam(req), q));
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = parse(createRoomTypeSchema, req.body);
  sendOk(res, await roomTypeService.createRoomType(input), 201);
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = parse(updateRoomTypeSchema, req.body);
  sendOk(res, await roomTypeService.updateRoomType(idParam(req), input));
}
