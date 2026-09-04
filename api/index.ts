import type { Request, Response } from 'express';
import app from '../server';

export const config = {
  maxDuration: 60
};

export default function handler(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      let rawUrl = req.url || '/';

      // Normalize potential pre-parsed body from Vercel
      if ((req as any).body !== undefined && (req as any).body !== null) {
        if (typeof (req as any).body === 'string') {
          try {
            (req as any).body = JSON.parse((req as any).body);
          } catch {
            // Keep original string if not valid JSON
          }
        }
        (req as any)._body = true;
      }

      // Parse incoming URL safely using Node's standard URL parser
      let pathname = '/';
      let search = '';
      try {
        const parsed = new URL(rawUrl, 'http://localhost');
        const endpointParam = parsed.searchParams.get('endpoint') || parsed.searchParams.get('1');
        
        if (endpointParam) {
          const cleanEp = endpointParam.replace(/^\/+/, '');
          parsed.searchParams.delete('endpoint');
          parsed.searchParams.delete('1');
          const remainingQuery = parsed.searchParams.toString();
          rawUrl = remainingQuery ? `/api/${cleanEp}?${remainingQuery}` : `/api/${cleanEp}`;
        } else if (parsed.pathname === '/' || parsed.pathname === '/api' || parsed.pathname === '/api/') {
          // Check standard Vercel rewrite headers
          const rawMatched = (
            req.headers['x-matched-path'] ||
            req.headers['x-invoke-path'] ||
            req.headers['x-forwarded-uri'] ||
            req.headers['x-vercel-matched-path'] ||
            (req as any).originalUrl
          ) as string | undefined;

          if (rawMatched && rawMatched !== '/' && rawMatched !== '/api' && rawMatched !== '/api/') {
            rawUrl = rawMatched;
          } else if (req.headers['x-now-route-matches']) {
            try {
              const matchesHeader = req.headers['x-now-route-matches'] as string;
              const match = matchesHeader.match(/1=([^&]+)/);
              if (match && match[1]) {
                const sub = decodeURIComponent(match[1]).replace(/^\/+/, '');
                rawUrl = `/api/${sub}`;
              }
            } catch {
              // Keep fallback
            }
          }
        }
      } catch {
        // Keep rawUrl as is
      }

      // Set clean restored URL on request object
      req.url = rawUrl;

      // Completion handlers for Vercel serverless lifecycle
      res.on('finish', () => resolve());
      res.on('close', () => resolve());
      res.on('error', (err) => reject(err));

      app(req, res, (err: any) => {
        if (err) {
          if (!res.headersSent) {
            res.status(500).json({ error: err?.message || 'Internal server error' });
          }
        } else if (!res.headersSent) {
          res.status(404).json({ error: `Not found: ${req.url}` });
        }
        resolve();
      });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || 'Serverless invocation error' });
      }
      resolve();
    }
  });
}
