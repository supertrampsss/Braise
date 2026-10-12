import { PUBLIC_ORIGIN } from "./release";
export const DISTRIBUTION = { name: "BRAIZ", origin: PUBLIC_ORIGIN, gameUrl: `${PUBLIC_ORIGIN}/`, embedUrl: `${PUBLIC_ORIGIN}/embed`, integrationUrl: `${PUBLIC_ORIGIN}/integration`, embedPolicy: "exact-owned-origins-only" } as const;
