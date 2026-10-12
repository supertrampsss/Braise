"use client";

export type AppSurface = "play" | "explore" | "profile";
export const APP_NAVIGATION = [
  { surface: "play", href: "/", label: "Jouer" },
  { surface: "explore", href: "/?surface=explore", label: "Explorer" },
  { surface: "profile", href: "/?surface=profile", label: "Profil" },
] as const;

/** Main Game may handle links in place to retain its input and current puzzle. */
export function AppNavigation({ active = "play", modeName, backHref = "/", onNavigate }: {
  active?: AppSurface; modeName?: string; backHref?: string;
  onNavigate?: (surface: AppSurface) => void;
}) {
  // Return destinations are internal only, including when supplied by another page.
  const safeBack = backHref.startsWith("/") && !backHref.startsWith("//") && !/[\u0000-\u0020\u007f\\]/.test(backHref) ? backHref : "/";
  return <header className="braiz-navigation">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation also works inside the controlled embed without client router state. */}
    <a href="/" className="braiz-navigation-brand" aria-label="BRAIZ, accueil">BRAIZ<span aria-hidden="true">.</span></a>
    <nav aria-label="Navigation principale"><ul>
      {APP_NAVIGATION.map(item => <li key={item.surface}><a href={item.href} aria-current={active === item.surface ? "page" : undefined} onClick={event => {
        if (onNavigate && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.button === 0) { event.preventDefault(); onNavigate(item.surface); }
      }}>{item.label}</a></li>)}
    </ul></nav>
    {modeName && <div className="braiz-mode-context"><strong>{modeName}</strong><a href={safeBack}>Revenir au jeu</a></div>}
  </header>;
}
