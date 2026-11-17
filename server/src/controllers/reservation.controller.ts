import type { Request, Response } from 'express';
import * as reservationService from '../services/reservation.service.js';
import {
  createReservationSchema,
  idempotencyKeySchema,
  reservationActionSchema,
  reservationListQuery,
} from '../validators/reservation.schemas.js';
import { parse } from '../validators/common.js';
import { sendOk, sendPage } from '../utils/http.js';
import { actorOf } from '../middleware/auth.js';
import { isStaff } from '../domain/lifecycle.js';

function idParam(req: Request): string {
  return String(req.params.id ?? '');
}

export async function create(req: Request, res: Response): Promise<void> {
  const actor = actorOf(req);
  const input = parse(createReservationSchema, req.body);
  const rawKey = req.header('idempotency-key');
  const key = rawKey ? parse(idempotencyKeySchema, rawKey) : null;

  const { reservation, replayed } = await reservationService.createReservation(actor, input, key);
  if (replayed) res.setHeader('Idempotent-Replayed', 'true');
  sendOk(res, reservation, replayed ? 200 : 201);
}

/** Guests always get only their own reservations; staff get everyone's with full filters. */
export async function list(req: Request, res: Response): Promise<void> {
  const actor = actorOf(req);
  const q = parse(reservationListQuery, req.query);
  const page = isStaff(actor.role)
    ? await reservationService.listAllReservations(actor, q)
    : await reservationService.listMyReservations(actor, q);
  sendPage(res, page);
}

export async function getById(req: Request, res: Response): Promise<void> {
  sendOk(res, await reservationService.getReservation(actorOf(req), idParam(req)));
}

export async function action(req: Request, res: Response): Promise<void> {
  const input = parse(reservationActionSchema, req.body);
  sendOk(res, await reservationService.performAction(actorOf(req), idParam(req), input.action, input.note ?? null));
}
