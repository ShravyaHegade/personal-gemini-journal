// Set serverless environment markers before importing server
process.env.IS_SERVERLESS = 'true';
if (!process.env.VERCEL) {
  process.env.VERCEL = '1';
}

import type { Request, Response } from 'express';
import app from '../server.ts';

export const config = {
  maxDuration: 60
};

// Safe startup diagnostic without exposing secrets
try {
  if (!app) {
    console.error('Vercel API initialization failed at app load');
  }
} catch {
  console.error('Vercel API initialization failed at module startup');
}

/**
 * Universal safe JSON sender that works on both raw Node.js ServerResponse
 * and Express-decorated Response objects.
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
 * Never corrupts or depends on fragile query string reconstruction.
 */
function resolvePath(req: Request): string {
  // 1. Check standard Vercel rewrite headers where original path is preserved
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

  // 2. Check if already a clean /api/* path
  if (rawUrl.startsWith('/api/')) {
    return rawUrl;
  }

  // 3. Check query params for endpoint if present
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

    // 1. Direct unauthenticated minimal health check
    if (
      req.method === 'GET' &&
      (resolvedPath === '/api/health' || resolvedPath === '/health' || resolvedPath.startsWith('/api/health?') || resolvedPath.startsWith('/health?'))
    ) {
      return sendJson(res, 200, {
        status: 'healthy',
        runtime: 'vercel'
      });
    }

    // 2. Normalize potential pre-parsed body from Vercel
    if ((req as any).body !== undefined && (req as any).body !== null) {
      if (typeof (req as any).body === 'string' && (req as any).body.trim().startsWith('{')) {
        try {
          (req as any).body = JSON.parse((req as any).body);
        } catch {
          // Keep raw string
        }
      }
      (req as any)._body = true;
    }

    // 3. Dispatch to Express application directly without a premature Promise wrapper
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel API initialization failed at request dispatch');
    if (!res.headersSent) {
      sendJson(res, 500, {
        error: 'Serverless invocation dispatch error'
      });
    }
  }
}
