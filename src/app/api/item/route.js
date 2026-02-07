import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import { NextResponse } from "next/server";

const DB_NAME = "wad-01";     // <-- your database name
const COLLECTION = "item";         // <-- your collection name

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

/**
 * GET /api/item?page=1&limit=10
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 10)));
    const skip = (page - 1) * limit;

    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const total = await db.collection(COLLECTION).countDocuments({});
    const data = await db
      .collection(COLLECTION)
      .find({})
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return NextResponse.json(
      {
        data,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      { headers: corsHeaders }
    );
  } catch (e) {
    return NextResponse.json(
      { message: e?.toString?.() ?? "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/item
 */
export async function POST(req) {
  try {
    const body = await req.json();

    const itemNameRaw = body.itemName != null ? String(body.itemName).trim() : "";
    const itemCategoryRaw = body.itemCategory != null ? String(body.itemCategory).trim() : "";
    const itemPriceRaw = body.itemPrice != null ? Number(body.itemPrice) : null;
    const status = String(body.status ?? "ACTIVE").trim().toUpperCase();

    if (itemPriceRaw != null && Number.isNaN(itemPriceRaw)) {
      return NextResponse.json(
        { message: "Invalid field: itemPrice" },
        { status: 400, headers: corsHeaders }
      );
    }

    const allowedStatus = new Set(["ACTIVE", "INACTIVE"]);
    const safeStatus = allowedStatus.has(status) ? status : "ACTIVE";

    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const insertDoc = {
      status: safeStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (itemNameRaw) insertDoc.itemName = itemNameRaw;
    if (itemCategoryRaw) insertDoc.itemCategory = itemCategoryRaw;
    if (itemPriceRaw != null) insertDoc.itemPrice = itemPriceRaw;

    const result = await db.collection(COLLECTION).insertOne(insertDoc);

    return NextResponse.json(
      { id: result.insertedId },
      { status: 201, headers: corsHeaders }
    );
  } catch (e) {
    return NextResponse.json(
      { message: e?.toString?.() ?? "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
