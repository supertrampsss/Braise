import { PRIVATE_METADATA } from '@/lib/site-seo';
export const metadata = PRIVATE_METADATA;
import { redirect } from "next/navigation";
import { EXTRA_MODES_ENABLED } from "@/lib/release";
export default function ReleaseBoundary({ children }: { children: React.ReactNode }) {
  if (!EXTRA_MODES_ENABLED) redirect("/");
  return children;
}
