import jwt from "jsonwebtoken";
import cookie from "cookie";
const JWT_SECRET = process.env.JWT_SECRET || "mydefaultjwtsecret";
// Use a strong secret in production
export function verifyJWT(req) {
 const result = verifyJWTWithReason(req);
 return result.user;
}

export function verifyJWTWithReason(req) {
 try {
 const cookies = req.headers.get("cookie") || "";
 const { token } = cookie.parse(cookies);
 if (!token) {
 return { user: null, reason: "missing_cookie" };
 }
 const decoded = jwt.verify(token, JWT_SECRET);
 return { user: decoded, reason: null };
 } catch (err) {
 if (err?.name === "TokenExpiredError") {
 return { user: null, reason: "token_expired" };
 }
 if (err?.name === "JsonWebTokenError") {
 return { user: null, reason: `jwt_error:${err.message}` };
 }
 return { user: null, reason: `unknown:${err?.message || "error"}` };
 }
}
// Example usage in an API route:
// import { verifyJWT } from "@/lib/auth";
// const user = verifyJWT(req);
// if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
