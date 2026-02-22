import { verifyJWTWithReason } from "@/lib/auth";
import { getCorsHeaders } from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const uploadDir = path.join(process.cwd(), "public", "uploads");

function buildUserFilter(user) {
  if (typeof user?.id === "string" && ObjectId.isValid(user.id)) {
    return { _id: new ObjectId(user.id) };
  }
  if (typeof user?.email === "string" && user.email.trim()) {
    return { email: user.email.trim() };
  }
  return null;
}

function sanitizeProfile(profile) {
  if (!profile) return null;
  const id = profile._id?.toString?.() ?? "";
  return {
    id,
    _id: id,
    firstname: profile.firstname ?? "",
    lastname: profile.lastname ?? "",
    email: profile.email ?? "",
    profileImagePath: profile.profileImagePath ?? "",
  };
}

function detectImageExtension(buffer) {
  const b = new Uint8Array(buffer);
  if (
    b.length >= 8 &&
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return ".png";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return ".jpg";
  }
  if (
    b.length >= 6 &&
    b[0] === 0x47 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x38 &&
    (b[4] === 0x39 || b[4] === 0x37) &&
    b[5] === 0x61
  ) {
    return ".gif";
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return ".webp";
  }
  return null;
}

export async function OPTIONS(req) {
 const corsHeaders = getCorsHeaders(req);
 return new Response(null, {
 status: 200,
 headers: corsHeaders,
 });
}
export async function GET (req) {
 const corsHeaders = getCorsHeaders(req);
 const auth = verifyJWTWithReason(req);
 if (!auth.user) {
 console.log("Profile GET auth failed:", auth.reason);
 return NextResponse.json(
 {
 message: "Unauthorized"},
 {
 status: 401,
 headers: corsHeaders
 }
 );
 }
 const user = auth.user;
 try {
 const client = await getClientPromise();
 const db = client.db("wad-01");
 const userFilter = buildUserFilter(user);
 if (!userFilter) {
  return NextResponse.json(
   { message: "Unauthorized" },
   { status: 401, headers: corsHeaders }
  );
 }
 const profile = await db.collection("user").findOne(userFilter);
 if (!profile) {
  return NextResponse.json(
   { message: "User not found" },
   { status: 404, headers: corsHeaders }
  );
 }
 return NextResponse.json(sanitizeProfile(profile), {
 headers: corsHeaders
 })
 }
 catch(error) {
 console.log("Get Profile Exception: ", error.toString());
 return NextResponse.json(
  { message: "Failed to load profile" },
  { status: 500, headers: corsHeaders }
 );
 }
}

export async function PUT(req) {
  const corsHeaders = getCorsHeaders(req);
  const auth = verifyJWTWithReason(req);
  if (!auth.user) {
    console.log("Profile PUT auth failed:", auth.reason);
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: corsHeaders }
    );
  }
  const user = auth.user;

  try {
    const formData = await req.formData();
    const firstname = String(formData.get("firstname") ?? "").trim();
    const lastname = String(formData.get("lastname") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const imageFile = formData.get("profileImage");

    if (!firstname || !lastname || !email) {
      return NextResponse.json(
        { message: "First name, last name, and email are required" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!email.includes("@")) {
      return NextResponse.json(
        { message: "Invalid email format" },
        { status: 400, headers: corsHeaders }
      );
    }

    const updateDoc = {
      firstname,
      lastname,
      email,
      updatedAt: new Date(),
    };

    if (imageFile && typeof imageFile === "object" && "arrayBuffer" in imageFile) {
      if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
        return NextResponse.json(
          { message: "Profile image must be 5MB or smaller" },
          { status: 400, headers: corsHeaders }
        );
      }

      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      const extension = detectImageExtension(imageBuffer);
      if (!extension) {
        return NextResponse.json(
          { message: "Only valid image files are allowed (jpg, png, gif, webp)" },
          { status: 400, headers: corsHeaders }
        );
      }

      await fs.mkdir(uploadDir, { recursive: true });
      const generatedName = `${crypto.randomBytes(32).toString("hex")}${extension}`;
      const filePath = path.join(uploadDir, generatedName);
      await fs.writeFile(filePath, imageBuffer);
      updateDoc.profileImagePath = `/uploads/${generatedName}`;
    }

    const client = await getClientPromise();
    const db = client.db("wad-01");
    const userFilter = buildUserFilter(user);
    if (!userFilter) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const currentUser = await db.collection("user").findOne(userFilter);
    if (!currentUser) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    const existingWithEmail = await db.collection("user").findOne({ email });
    if (existingWithEmail && existingWithEmail._id?.toString?.() !== currentUser._id?.toString?.()) {
      return NextResponse.json(
        { message: "Duplicate Email!!" },
        { status: 400, headers: corsHeaders }
      );
    }

    await db.collection("user").updateOne(userFilter, { $set: updateDoc });
    const updated = await db.collection("user").findOne(userFilter);

    return NextResponse.json(sanitizeProfile(updated), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.log("Update Profile Exception:", error.toString());
    return NextResponse.json(
      { message: "Failed to update profile" },
      { status: 500, headers: corsHeaders }
    );
  }
}
