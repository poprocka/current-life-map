import { NextResponse } from "next/server";
import { serviceClient, NOT_CONFIGURED } from "@/lib/supabase-server";
import { CONTENT_VERSION } from "@/content/v10/question-bank";

export async function POST() {
  const db = serviceClient();
  if (!db) return NextResponse.json(NOT_CONFIGURED, { status: 503 });
  const { data, error } = await db.from("maps").insert({ content_version: CONTENT_VERSION }).select("token").single();
  if (error) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json({ token: data.token });
}
