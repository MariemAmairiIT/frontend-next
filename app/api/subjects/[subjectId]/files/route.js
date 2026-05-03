import { NextResponse } from "next/server";
import qcmStore from "@/lib/qcmStore";

export async function GET(req, { params }) {
  const subjectId = params.subjectId;
  const files = qcmStore.listFiles(subjectId);
  return NextResponse.json(files);
}

export async function POST(req, { params }) {
  const subjectId = params.subjectId;
  try {
    const form = await req.formData();
    const files = form.getAll("files");
    const saved = [];

    for (const f of files) {
      // `f` is a File object in the Web Fetch API
      const filename = f.name || "unknown";
      const mimeType = f.type || "application/octet-stream";
      const buffer = await f.arrayBuffer();
      const file = qcmStore.addFile(subjectId, { filename, buffer, mimeType });
      saved.push(file);
    }

    return NextResponse.json({ saved });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
