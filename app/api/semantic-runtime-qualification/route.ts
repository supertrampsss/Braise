import { env } from 'cloudflare:workers';
import { semanticRuntimeQualification, type RuntimeQualificationSet } from '@/lib/semantic-runtime-qualification';
import type { RangeBucket } from '@/lib/semantic-v2-range-r2';
import compiled from '@/lib/semantic-runtime-qualification-set.json';
import { RUNTIME_QUALIFICATION_PIN } from '@/lib/semantic-runtime-qualification-pin';
export const POST = (request: Request) => {
  const runtime = env as unknown as Record<string, unknown>;
  return semanticRuntimeQualification(request, {
    token: runtime.BRAIZ_TRANSFER_TOKEN as string | undefined,
    expires: runtime.BRAIZ_TRANSFER_EXPIRES as string | undefined,
    pinset: runtime.BRAIZ_RUNTIME_QUALIFICATION_PIN as string | undefined,
    bucket: runtime.SEMANTIC_DATA as RangeBucket | undefined,
  }, compiled as RuntimeQualificationSet, RUNTIME_QUALIFICATION_PIN);
};
