import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function s3Configured() {
  return Boolean(
    process.env.STORAGE_BUCKET &&
      process.env.STORAGE_REGION &&
      process.env.STORAGE_ACCESS_KEY_ID &&
      process.env.STORAGE_SECRET_ACCESS_KEY
  );
}

function s3Client() {
  return new S3Client({
    region: process.env.STORAGE_REGION,
    endpoint: process.env.STORAGE_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT),
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
    },
  });
}

export type UploadTarget =
  | { mode: "s3-presigned"; uploadUrl: string; publicUrl: string; key: string }
  | { mode: "local-direct"; uploadUrl: string; publicUrl: string; key: string };

/**
 * Returns a place for the browser to PUT a photo directly. In production this is a
 * presigned S3/R2 URL; in local dev (no storage env configured) it's our own
 * upload route writing to public/uploads so the workflow works with zero setup.
 */
export async function createUploadTarget(orgId: string, filename: string, contentType: string): Promise<UploadTarget> {
  const ext = path.extname(filename) || "";
  const key = `${orgId}/${randomUUID()}${ext}`;

  if (s3Configured()) {
    const client = s3Client();
    const command = new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const publicBase = process.env.STORAGE_PUBLIC_BASE_URL?.replace(/\/$/, "");
    const publicUrl = publicBase
      ? `${publicBase}/${key}`
      : `https://${process.env.STORAGE_BUCKET}.s3.${process.env.STORAGE_REGION}.amazonaws.com/${key}`;
    return { mode: "s3-presigned", uploadUrl, publicUrl, key };
  }

  return {
    mode: "local-direct",
    uploadUrl: `/api/uploads/local?key=${encodeURIComponent(key)}`,
    publicUrl: `/uploads/${key}`,
    key,
  };
}

/** Used only by the local-dev fallback upload route. */
export async function writeLocalUpload(key: string, data: Buffer) {
  const destination = path.join(LOCAL_UPLOAD_DIR, key);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
}
