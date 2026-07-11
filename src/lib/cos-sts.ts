import "server-only"

import STS from "qcloud-cos-sts"

import { getCosConfig } from "@/lib/uploads"

const STS_DURATION_SECONDS = 15 * 60

export async function issueCosUploadCredentials(storageKeys: string[]) {
  const { SecretId, SecretKey, Bucket, Region } = getCosConfig()
  const policy = STS.getPolicy(storageKeys.map((storageKey) => ({
    action: "name/cos:PutObject",
    bucket: Bucket,
    region: Region,
    prefix: storageKey,
  })))
  const data = await STS.getCredential({
    secretId: SecretId,
    secretKey: SecretKey,
    durationSeconds: STS_DURATION_SECONDS,
    policy,
  })

  return {
    bucket: Bucket,
    region: Region,
    credentials: {
      tmpSecretId: data.credentials.tmpSecretId,
      tmpSecretKey: data.credentials.tmpSecretKey,
      sessionToken: data.credentials.sessionToken,
      startTime: data.startTime,
      expiredTime: data.expiredTime,
    },
  }
}
