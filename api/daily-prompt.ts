import type { Request, Response } from 'express';
import app from '../server';

export default function handler(req: Request, res: Response) {
  const rawUrl = req.url || '';
  const queryIndex = rawUrl.indexOf('?');
  const query = queryIndex !== -1 ? rawUrl.slice(queryIndex) : '';
  req.url = `/api/daily-prompt${query}`;
  return app(req, res);
}
