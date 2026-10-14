import { redirect } from "next/navigation";
import { EXTRA_MODES_ENABLED } from "@/lib/release";
import './duel.css';
export default function ReleaseBoundary({ children }: { children: React.ReactNode }) {
  if (!EXTRA_MODES_ENABLED) redirect("/");
  return children;
}
