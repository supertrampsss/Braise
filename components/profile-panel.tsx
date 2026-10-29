"use client";

import { useState } from "react";
import { Volume2, Sparkles } from "lucide-react";
import { DeviceSync, type DeviceSyncGuard } from "@/components/device-sync";
import { ProfileTransfer } from "@/components/profile-transfer";
import { LocalBackupTransfer } from "@/components/local-backup-transfer";
import { MetricsPreferences } from "@/components/metrics-preferences";
import { CosmeticPicker, WeeklyRitualCard } from "@/components/weekly-ritual";
import { ProductDiagnostics } from "@/components/product-diagnostics";
import { CalendarReminderControl } from "@/components/calendar-reminder";
import { personalStatistics, PERSONAL_MODES } from "@/lib/personal-statistics";
import type { ProfileSnapshot } from "@/lib/profile-storage";
import type { CosmeticId, WeeklyProjection } from "@/lib/weekly-ritual";
import { formatDateFr, formatNumberFr } from "@/lib/format-fr";
import { countLabel } from "@/lib/game-copy";
import "@/components/profile-panel.css";

type Props = { snapshot: ProfileSnapshot; ritual: WeeklyProjection | null; now: string; busy: boolean; flamePaused: boolean; onSound: (value: boolean) => void; onAnimations: () => void; onCosmetic: (id: CosmeticId) => void; onSnapshot: (snapshot: ProfileSnapshot) => void; onDeviceSync?: (snapshot: ProfileSnapshot) => void; deviceSyncGuard?: DeviceSyncGuard; onBack: () => void };
export function ProfilePanel({ snapshot, ritual, now, busy, flamePaused, onSound, onAnimations, onCosmetic, onSnapshot, onDeviceSync, deviceSyncGuard, onBack }: Props) {
  const [visibleHistory, setVisibleHistory] = useState(50);
  const profile = snapshot.profile;
  const statistics = personalStatistics(profile.wins, new Date(now));
  const xp = profile.wins.length * 150 + Math.min(profile.guesses, 10000) * 2;
  const level = Math.floor(xp / 500) + 1;
  const milestones = [
    { name: "Première étincelle", rule: "Trouver un mot", done: statistics.totalWins >= 1 },
    { name: "L’intuition juste", rule: "Trouver un mot en 10 essais maximum, sans indice", done: profile.wins.some(win => win.tries <= 10 && win.hints === 0) },
    { name: "Ça devient un rituel", rule: "Atteindre une série de 3 quotidiens de suite", done: statistics.dailyStreak >= 3 },
    { name: "Gardien du feu", rule: "Trouver 10 mots", done: statistics.totalWins >= 10 },
  ];
  return <section className="reference-profile personal-profile" aria-labelledby="profile-title">
    <button className="reference-back" type="button" onClick={onBack}>Revenir au jeu</button>
    <h1 id="profile-title">Votre progression</h1>
    <p className="profile-scope">Enregistrée sur cet appareil. <a href="#profile-backup">Sauvegarder ou transférer</a></p>
    {!snapshot.persisted && <p className="transfer-error" role="alert">La sauvegarde locale est indisponible. Téléchargez une copie avant de quitter la page.</p>}
    <section className="profile-summary" aria-label="Résumé de progression">
      <div><strong>{formatNumberFr(statistics.totalWins)}</strong><span>{statistics.totalWins === 1 ? "mot trouvé" : "mots trouvés"}</span></div>
      <div><strong>{formatNumberFr(statistics.dailyStreak)}</strong><span>{statistics.dailyStreak === 1 ? "jour" : "jours"} de série quotidienne</span></div>
      <div><strong>{statistics.medianTries == null ? <><span aria-hidden="true">n/d</span><span className="sr-only">Non disponible</span></> : formatNumberFr(statistics.medianTries)}</strong><span>essais médians par réussite</span></div>
    </section>
    {ritual && <details className="reference-setting profile-details"><summary>Objectifs de la semaine</summary><WeeklyRitualCard projection={ritual} /></details>}
    <details className="reference-setting profile-details"><summary>Réussites et statistiques détaillées</summary>
      <ul className="profile-milestones">{milestones.map(item => <li key={item.name}><strong>{item.name}</strong><span>{item.done ? "Atteint" : "À atteindre"} · {item.rule}</span></li>)}</ul>
      <p>Calculées sur vos réussites enregistrées.</p>
      <dl className="profile-measurements"><div><dt>Essais médians</dt><dd>{formatNumberFr(statistics.medianTries)} <small>sur {countLabel(statistics.trialsSample, "réussite renseignée", "réussites renseignées")}</small></dd></div><div><dt>Indices médians</dt><dd>{formatNumberFr(statistics.medianHints)} <small>sur {countLabel(statistics.hintsSample, "réussite renseignée", "réussites renseignées")}</small></dd></div><div><dt>Indices utilisés dans les réussites</dt><dd>{formatNumberFr(statistics.totalHints)} <small>sur {countLabel(statistics.hintsSample, "réussite renseignée", "réussites renseignées")}</small></dd></div></dl>
      <div className="profile-table-scroll" tabIndex={0} role="region" aria-label="Statistiques par mode"><table><caption>Réussites par mode</caption><thead><tr><th scope="col">Mode</th><th scope="col">Réussites</th><th scope="col">Essais médians</th><th scope="col">Indices médians</th></tr></thead><tbody>{statistics.modes.map(mode => <tr key={mode.mode}><th scope="row">{mode.label}</th><td>{formatNumberFr(mode.wins)}</td><td>{formatNumberFr(mode.medianTries)}<small>{countLabel(mode.trialsSample, "réussite renseignée", "réussites renseignées")}</small></td><td>{formatNumberFr(mode.medianHints)}<small>{countLabel(mode.hintsSample, "réussite renseignée", "réussites renseignées")}</small></td></tr>)}</tbody></table></div>
      <h3>Évolution dans le temps</h3><p>{countLabel(statistics.datedWins, "réussite datée", "réussites datées")}{statistics.undatedWins ? ` · ${formatNumberFr(statistics.undatedWins)} sans date de fin` : ""}.</p>
      {statistics.trend.length ? <div className="profile-table-scroll" tabIndex={0} role="region" aria-label="Évolution datée"><table><caption>Les 12 derniers jours avec une réussite datée · Paris</caption><thead><tr><th scope="col">Date de réussite</th><th scope="col">Réussites</th><th scope="col">Essais médians</th></tr></thead><tbody>{statistics.trend.slice(-12).map(day => <tr key={day.date}><th scope="row">{formatDateFr(day.date)}</th><td>{day.wins}</td><td>{formatNumberFr(day.medianTries)}<small>sur {countLabel(day.trialsSample, "réussite renseignée", "réussites renseignées")}</small></td></tr>)}</tbody></table></div> : <p>Pas encore de réussite datée : aucune tendance disponible.</p>}
      <details><summary>Historique personnel ({countLabel(statistics.totalWins, "réussite")})</summary>
        <ol className="profile-history">{statistics.history.slice(0, visibleHistory).map(win => <li key={win.id}><strong>{PERSONAL_MODES.find(mode => mode.mode === win.mode)?.label ?? "Mode inconnu"}</strong><span>{win.completedAt && Number.isFinite(Date.parse(win.completedAt)) && Date.parse(win.completedAt) <= Date.parse(now) ? `Réussi le ${formatDateFr(win.completedAt, true)}` : "Date de réussite non enregistrée"}</span>{["daily", "archive"].includes(win.mode) && <small>Énigme du {formatDateFr(win.date)}</small>}<small>{countLabel(win.tries, "essai")} · {countLabel(win.hints, "indice")}</small></li>)}</ol>
        {visibleHistory < statistics.totalWins && <button className="text-action" type="button" onClick={() => setVisibleHistory(count => count + 50)}>Voir les 50 suivantes</button>}
      </details>
      <details><summary>Calcul des statistiques et du niveau</summary><p>Les médianes portent sur les réussites renseignées uniquement. Les parties sans date de fin ne sont pas ajoutées à l’évolution. La série suit les quotidiens à l’heure de Paris, jamais les archives.</p><p>Niveau {formatNumberFr(level)} · {formatNumberFr(xp)} XP. {formatNumberFr(500 - xp % 500)} XP avant le niveau suivant. +2 XP par proposition, +150 par victoire ; indices sans XP.</p></details>
    </details>
    <details className="reference-setting profile-details"><summary>Styles permanents</summary>{ritual && <CosmeticPicker projection={ritual} disabled={busy} onSelect={onCosmetic} />}</details>
    <section className="profile-preferences" aria-labelledby="profile-preferences-title"><h2 id="profile-preferences-title">Préférences</h2>
      <button className="reference-setting" role="switch" aria-checked={profile.sound} disabled={busy} type="button" onClick={() => onSound(!profile.sound)}><span><Volume2 aria-hidden="true" /> Son {profile.sound ? "activé" : "désactivé"}</span><i aria-hidden="true" className={profile.sound ? "ref-switch on" : "ref-switch"} /></button>
      <button className="reference-setting" role="switch" aria-checked={!flamePaused} type="button" onClick={onAnimations}><span><Sparkles aria-hidden="true" /> Animations {!flamePaused ? "activées" : "en pause"}</span><i aria-hidden="true" className={!flamePaused ? "ref-switch on" : "ref-switch"} /></button>
      <CalendarReminderControl />
      <MetricsPreferences />
    </section>
    <section id="profile-backup" className="profile-backup" aria-labelledby="profile-backup-title"><h2 id="profile-backup-title">Vos données</h2>
      <LocalBackupTransfer snapshot={snapshot} onSnapshot={onDeviceSync ?? onSnapshot} disabled={busy} mergeGuard={deviceSyncGuard} />
      <section className="profile-duel-access"><h3>Accès à mes duels</h3><p>Les duels sont liés à votre identité. La sauvegarde de parties ne contient pas votre accès.</p><a className="secondary-button" href="/espace">Sauvegarder ou récupérer mon accès</a></section>
      <details className="reference-setting profile-details"><summary>Synchronisation en ligne</summary><DeviceSync snapshot={snapshot} onSnapshot={onDeviceSync ?? onSnapshot} disabled={busy} mergeGuard={deviceSyncGuard} /></details>
      <details className="reference-setting profile-details"><summary>Profil seul</summary><ProfileTransfer snapshot={snapshot} onSnapshot={onSnapshot} /></details>
      <details className="reference-setting profile-details"><summary>Diagnostic local</summary><p>Format du profil : v{snapshot.formatVersion}.{snapshot.backupConfirmed ? " L’ancien profil est conservé sans modification." : ""}</p><ProductDiagnostics /></details>
    </section>
  </section>;
}
