import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { getStorageEnv } from "@/server/env";

let client: S3Client | undefined;

export function getPrivateStorage() {
  const config = getStorageEnv();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });
  return { client, bucket: config.R2_BUCKET };
}
