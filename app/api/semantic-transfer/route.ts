import { env } from 'cloudflare:workers';
import { semanticTransfer, type TransferBucket } from '@/lib/semantic-transfer';
const handle = (request: Request) => {
  const runtime = env as unknown as Record<string, unknown>;
  return semanticTransfer(request, {
    token: runtime.BRAIZ_TRANSFER_TOKEN as string | undefined,
    expires: runtime.BRAIZ_TRANSFER_EXPIRES as string | undefined,
    bucket: runtime.SEMANTIC_DATA as TransferBucket | undefined,
  });
};
export const PUT = handle;
export const HEAD = handle;
export const GET = handle;
