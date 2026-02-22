const BASE_CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://lynn-server.koreacentral.cloudapp.azure.com",
];

function getAllowedOrigins() {
  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

export function getCorsHeaders(req) {
  const requestOrigin = req?.headers?.get?.("origin") || "";
  const allowedOrigins = getAllowedOrigins();
  const resolvedOrigin = isAllowedOrigin(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];

  return {
    ...BASE_CORS_HEADERS,
    "Access-Control-Allow-Origin": resolvedOrigin,
    Vary: "Origin",
  };
}

const corsHeaders = getCorsHeaders();

export default corsHeaders;
