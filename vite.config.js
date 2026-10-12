import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Helper to load .env into process.env for local Vite development
function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
  // Fallbacks for local testing
  process.env.TALLY_MOCK_MODE = process.env.TALLY_MOCK_MODE || 'true';
  process.env.TALLY_URL = process.env.TALLY_URL || 'http://localhost:9000';
  process.env.TALLY_COMPANY = process.env.TALLY_COMPANY || 'Acme Trading Co (2025-2026)';
}

/**
 * Netlify Functions Development Middleware for Vite
 * Allows running `npm run dev` directly without needing Netlify CLI on port 8888.
 */
function netlifyFunctionsDevPlugin() {
  return {
    name: 'netlify-functions-dev',
    configureServer(server) {
      loadLocalEnv();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/.netlify/functions/')) {
          return next();
        }

        try {
          const parsedUrl = new URL(req.url, 'http://localhost:5173');
          const functionName = parsedUrl.pathname.replace('/.netlify/functions/', '').split('/')[0];

          // Collect body for POST/PUT requests
          let body = '';
          for await (const chunk of req) {
            body += chunk;
          }

          const queryStringParameters = {};
          parsedUrl.searchParams.forEach((val, key) => {
            queryStringParameters[key] = val;
          });

          const event = {
            httpMethod: req.method,
            path: parsedUrl.pathname,
            queryStringParameters,
            headers: req.headers,
            body: body || null,
          };

          const funcFilePath = path.resolve(process.cwd(), `netlify/functions/${functionName}.js`);
          if (!fs.existsSync(funcFilePath)) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: `Function ${functionName} not found` }));
            return;
          }

          // Dynamically execute the function handler in Node SSR environment
          const mod = await server.ssrLoadModule(`./netlify/functions/${functionName}.js`);
          if (!mod.handler) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: `Function ${functionName} does not export handler` }));
            return;
          }

          const result = await mod.handler(event, {});
          res.statusCode = result.statusCode || 200;

          if (result.headers) {
            for (const [key, value] of Object.entries(result.headers)) {
              res.setHeader(key, value);
            }
          }

          res.end(result.body || '');
        } catch (err) {
          console.error(`[netlify-functions-dev] Error executing ${req.url}:`, err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message: err.message, errorCode: 'DEV_FUNCTION_ERROR' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), netlifyFunctionsDevPlugin()],
  server: {
    port: 5173,
  },
});
