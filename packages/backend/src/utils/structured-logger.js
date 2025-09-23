// packages/backend/src/utils/structured-logger.js
// Utility for creating structured JSON loggers with timing capabilities.
// To provide consistent, parseable logging across the application.
// Relevant files: rag-service.js
export function createLogger(scope) {
  const base = { scope };
  return {
    info: (msg, extra = {}) => console.log(JSON.stringify({ level: 'info', msg, ...base, ...extra })),
    warn: (msg, extra = {}) => console.warn(JSON.stringify({ level: 'warn', msg, ...base, ...extra })),
    error: (msg, extra = {}) => console.error(JSON.stringify({ level: 'error', msg, ...base, ...extra })),
    time: (label) => {
      const start = Date.now();
      return {
        end(extra = {}) {
          const ms = Date.now() - start;
          console.log(JSON.stringify({ level: 'info', msg: `timing:${label}`, ...base, ms, ...extra }));
          return ms;
        }
      };
    }
  };
}


