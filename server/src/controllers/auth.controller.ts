import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';
import { parse } from '../validators/common.js';
import { sendOk } from '../utils/http.js';
import { actorOf } from '../middleware/auth.js';

export async function register(req: Request, res: Response): Promise<void> {
  const input = parse(registerSchema, req.body);
  sendOk(res, await authService.register(input), 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = parse(loginSchema, req.body);
  sendOk(res, await authService.login(input));
}

export async function me(req: Request, res: Response): Promise<void> {
  sendOk(res, await authService.getCurrentUser(actorOf(req).userId));
}
