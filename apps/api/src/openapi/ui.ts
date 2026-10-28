import type { RequestHandler } from 'express';

// Swagger UI's HTML shell uses inline bootstrap scripts and styles, which the
// default helmet CSP (default-src 'none') blocks in the browser. Override the
// policy for the docs routes only; the rest of the API keeps helmet's defaults.
export const swaggerUiCsp: RequestHandler = (_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
    ].join('; '),
  );
  next();
};
