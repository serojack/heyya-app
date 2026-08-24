import { randomUUID } from "node:crypto";

const SIDECAR_URL = "http://127.0.0.1:1106";

function parsePrivateDir() {
  const raw = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!raw) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const parts = raw.replace(/^\/+/, "").split("/");
  const bucketName = parts.shift();
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR is invalid");
  return { bucketName, prefix: parts.filter(Boolean).join("/") };
}

async function signedObjectUrl(objectName: string, method: "PUT" | "GET") {
  const { bucketName } = parsePrivateDir();
  const response = await fetch(`${SIDECAR_URL}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Unable to create private upload URL (${response.status})`);
  const data = await response.json() as { signed_url: string };
  return data.signed_url;
}

function objectNameFromPath(objectPath: string) {
  if (!objectPath.startsWith("/objects/")) throw new Error("Invalid object path");
  const { prefix } = parsePrivateDir();
  const suffix = objectPath.replace("/objects/", "");
  return [prefix, suffix].filter(Boolean).join("/");
}

export const privateStorage = {
  async createUpload() {
    const { prefix } = parsePrivateDir();
    const suffix = `uploads/${randomUUID()}`;
    const objectName = [prefix, suffix].filter(Boolean).join("/");
    return {
      objectPath: `/objects/${suffix}`,
      uploadUrl: await signedObjectUrl(objectName, "PUT"),
    };
  },
  async createDownloadUrl(objectPath: string) {
    return signedObjectUrl(objectNameFromPath(objectPath), "GET");
  },
};