/**
 * POST /api/recordings: while developing only (`pnpm dev`), a finished recitation's recording is
 * saved to `recordings/` in the project, so problems seen while testing on this computer can be
 * replayed and fixed. In any other build it does nothing (404).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  const text = await req.text();
  if (text.length > 5_000_000) return new NextResponse(null, { status: 413 });
  const json = JSON.parse(text) as { app?: string };
  if (json.app !== "hifz-recite-recording") return new NextResponse(null, { status: 400 });
  const dir = join(process.cwd(), "recordings");
  await mkdir(dir, { recursive: true });
  const name = `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(join(dir, name), text);
  return NextResponse.json({ saved: name });
}
