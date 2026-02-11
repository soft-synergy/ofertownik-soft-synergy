const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy tylko dla API, nie dla statycznych plików
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'https://oferty.soft-synergy.com',
      changeOrigin: true,
      secure: true,
      logLevel: 'debug'
    })
  );
};

