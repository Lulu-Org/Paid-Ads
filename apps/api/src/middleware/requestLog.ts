import type { RequestHandler } from 'express';

// Logs one line per request after the response finishes: method, path, status, duration.
// Never logs request bodies or headers.
export const requestLog: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
  });
  next();
};
