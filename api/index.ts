import type { Request, Response } from 'express';
import app from '../server.ts';

export const config = {
  maxDuration: 60
};

/**
 * Universal safe JSON sender that works reliably on both raw Node.js ServerResponse
 * and Express-decorated Response objects without throwing or exposing internals.
 */
function sendJson(res: any, statusCode: number, data: any) {
  try {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      res.status(statusCode).json(data);
    } else {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    }
  } catch {
    try {
      res.statusCode = statusCode;
      res.end(JSON.stringify(data));
    } catch {}
  }
}

/**
 * Cleanly resolves the incoming route path from headers, query params, or URL.
 */
function resolvePath(req: Request): string {
  const originalHeaderPath = (
    req.headers['x-matched-path'] ||
    req.headers['x-invoke-path'] ||
    req.headers['x-forwarded-uri'] ||
    req.headers['x-vercel-matched-path'] ||
    (req as any).originalUrl
  );

  if (
    typeof originalHeaderPath === 'string' &&
    originalHeaderPath.startsWith('/api/') &&
    originalHeaderPath !== '/api' &&
    originalHeaderPath !== '/api/'
  ) {
    return originalHeaderPath;
  }

  const rawUrl = req.url || '/';

  if (rawUrl.startsWith('/api/')) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const endpoint = parsed.searchParams.get('endpoint') || parsed.searchParams.get('1');
    if (endpoint) {
      const cleanEndpoint = endpoint.replace(/^\/+/, '');
      parsed.searchParams.delete('endpoint');
      parsed.searchParams.delete('1');
      const search = parsed.searchParams.toString();
      return search ? `/api/${cleanEndpoint}?${search}` : `/api/${cleanEndpoint}`;
    }

    if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '/api' && parsed.pathname !== '/api/') {
      const cleanPath = parsed.pathname.replace(/^\/+/, '');
      const search = parsed.search;
      return `/api/${cleanPath}${search}`;
    }
  } catch {
    // Fall back to rawUrl
  }

  return rawUrl;
}

export default function handler(req: Request, res: Response) {
  try {
    const resolvedPath = resolvePath(req);
    req.url = resolvedPath;

    // 1. Minimal health check: handled immediately without external calls
    if (
      req.method === 'GET' &&
      (
        resolvedPath === '/api/health' ||
        resolvedPath === '/health' ||
        resolvedPath.startsWith('/api/health?') ||
        resolvedPath.startsWith('/health?')
      )
    ) {
      return sendJson(res, 200, {
        status: 'healthy',
        runtime: 'vercel'
      });
    }

    // 2. Normalize pre-parsed body from Vercel if needed
    if ((req as any).body !== undefined && (req as any).body !== null) {
      if (typeof (req as any).body === 'string' && (req as any).body.trim().startsWith('{')) {
        try {
          (req as any).body = JSON.parse((req as any).body);
        } catch {}
      }
      (req as any)._body = true;
    }

    // 3. Dispatch to Express application
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel API] initialization failed:', err?.message || 'Dispatch error');
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: 'Internal Server Error'
      });
    }
  }
}
