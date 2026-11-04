const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The dev server gzips every bundle on every request, which takes about 20 seconds here and
// leaves the browser blank meanwhile. An uncompressed bundle arrives in under 2 seconds.
// This only affects the development server, not release builds.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    delete req.headers['accept-encoding'];
    return middleware(req, res, next);
  },
};

module.exports = config;
