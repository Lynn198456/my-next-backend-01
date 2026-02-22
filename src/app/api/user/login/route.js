import { getCorsHeaders } from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
const JWT_SECRET = process.env.JWT_SECRET || "mydefaultjwtsecret"; // Use a strong secret in production

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

  const sameSite = isCrossSite ? "none" : "lax";
  const secure = sameSite === "none" ? true : isHttpsRequest;

  return { sameSite, secure, isCrossSite };
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
 const data = await req.json(); const { email, password } = data;
 if (!email || !password) {
 return NextResponse.json({
 message: "Missing email or password"
 }, {
 status: 400,
 headers: corsHeaders
 });
 }
 try {
 const client = await getClientPromise();
 const db = client.db("wad-01");
 const user = await db.collection("user").findOne({ email });
 if (!user) {
 return NextResponse.json({
 message: "Invalid email or password"
 }, {
 status: 401,
 headers: corsHeaders
 });
 }
 const passwordMatch = await bcrypt.compare(password, user.password);
 if (!passwordMatch) {
 return NextResponse.json({
 message: "Invalid email or password"
 }, {
 status: 401,
 headers: corsHeaders
 });
 }
 // Generate JWT
 const token = jwt.sign({
 id: user._id,
 email: user.email,
 username: user.username
 }, JWT_SECRET, { expiresIn: "7d" });
 const cookiePolicy = getTokenCookiePolicy(req);
 if (cookiePolicy.isCrossSite) {
  console.log("Login cookie policy: cross-site mode (SameSite=None; Secure)");
 }
 // Set JWT as HTTP-only cookie
 const response = NextResponse.json({
 message: "Login successful"
 }, {
 status: 200,
 headers: corsHeaders});
 response.cookies.set("token", token, {
 httpOnly: true,
 sameSite: cookiePolicy.sameSite,
 path: "/",
 maxAge: 60 * 60 * 24 * 7, // 7 days
 secure: cookiePolicy.secure
 });
 return response;
 } catch (exception) {
 console.log("exception", exception.toString());
 return NextResponse.json({
 message: "Internal server error"
 }, {
 status: 500,
 headers: corsHeaders
 });
 }
} 
