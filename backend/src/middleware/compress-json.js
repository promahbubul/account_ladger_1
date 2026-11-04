import { gzip } from 'node:zlib';

const MIN_BYTES = 1024;

// Gzips large JSON responses using Node's built-in zlib, so a deploy needs no new package.
// Auth responses are skipped because they carry secrets next to text the client sent.
export function compressJson(req, res, next) {
  const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (!acceptsGzip || req.path.startsWith('/api/auth')) {
    next();
    return;
  }

  const sendJson = res.json.bind(res);
  res.json = (body) => {
    const raw = Buffer.from(JSON.stringify(body));
    if (raw.length < MIN_BYTES) return sendJson(body);

    gzip(raw, (err, zipped) => {
      if (res.headersSent) return;
      if (err) {
        sendJson(body);
        return;
      }
      res.vary('Accept-Encoding');
      res.set('Content-Encoding', 'gzip');
      res.type('application/json');
      res.send(zipped);
    });
    return res;
  };
  next();
}
