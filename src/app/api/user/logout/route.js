import { getCorsHeaders } from "@/lib/cors";
import { NextResponse } from "next/server";

function getHostnameFromHostHeader(hostHeader) {
  if (!hostHeader) return "";
  try {
    return new URL(`http://${hostHeader}`).hostname;
  } catch {
    return hostHeader.split(":")[0];
  }
}

function getTokenCookiePolicy(req) {
  const requestOrigin = req.headers.get("origin") || "";
  const requestHost = req.headers.get("host") || "";
  const forwardedProto = req.headers.get("x-forwarded-proto") || "";

  let originHostname = "";
  let originProtocol = "";
  if (requestOrigin) {
    try {
      const originUrl = new URL(requestOrigin);
      originHostname = originUrl.hostname;
      originProtocol = originUrl.protocol;
    } catch {
      // Ignore invalid origin and fall back to same-site defaults.
    }
  }

  const hostHostname = getHostnameFromHostHeader(requestHost);
  const isCrossSite = Boolean(originHostname && hostHostname && originHostname !== hostHostname);
  const isHttpsRequest =
    forwardedProto === "https" ||
    originProtocol === "https:" ||
    process.env.NODE_ENV === "production";

  return {
    sameSite: isCrossSite ? "none" : "lax",
    secure: isCrossSite ? true : isHttpsRequest,
  };
}

export async function OPTIONS(req) {
 const corsHeaders = getCorsHeaders(req);
 return new Response(null, {
 status: 200,
 headers: corsHeaders,
 });
}
export async function POST(req) {
 const corsHeaders = getCorsHeaders(req);
 const cookiePolicy = getTokenCookiePolicy(req);
 // Clear the JWT cookie by setting it to empty and expired
 const response = NextResponse.json({
 message: "Logout successful"
 }, {
 status: 200,
 headers: corsHeaders
 });
 response.cookies.set("token", "", {
 httpOnly: true,
 sameSite: cookiePolicy.sameSite,
 path: "/",
 maxAge: 0,
 secure: cookiePolicy.secure
 });
 return response;
} 
