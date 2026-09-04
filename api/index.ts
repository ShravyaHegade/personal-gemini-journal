import type { Request, Response } from 'express';
import app from '../server';

export default function handler(req: Request, res: Response) {
  let url = req.url || '/';

  // If Vercel rewrites stripped the subpath (e.g. req.url is '/' or '/api' or '/api/'),
  // recover the original subpath from Vercel headers or query parameters
  if (url === '/' || url === '/api' || url === '/api/') {
    const rawMatched = (
      req.headers['x-matched-path'] ||
      req.headers['x-invoke-path'] ||
      req.headers['x-forwarded-uri'] ||
      req.headers['x-vercel-matched-path']
    ) as string | undefined;

    if (rawMatched && rawMatched !== '/' && rawMatched !== '/api') {
      url = rawMatched;
    } else if (req.headers['x-now-route-matches']) {
      try {
        const matchesHeader = req.headers['x-now-route-matches'] as string;
        const match = matchesHeader.match(/1=([^&]+)/);
        if (match && match[1]) {
          const sub = decodeURIComponent(match[1]);
          url = sub.startsWith('/') ? `/api${sub}` : `/api/${sub}`;
        }
      } catch {
        // Keep fallback url
      }
    } else if ((req as any).query && typeof (req as any).query['1'] === 'string') {
      const sub = (req as any).query['1'];
      url = sub.startsWith('/') ? `/api${sub}` : `/api/${sub}`;
    }
  }

  req.url = url;
  return app(req, res);
}
