"use client";

import { useState } from "react";
import { Volume2, Sparkles } from "lucide-react";
import { DeviceSync, type DeviceSyncGuard } from "@/components/device-sync";
import { ProfileTransfer } from "@/components/profile-transfer";
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
    <p className="profile-scope">Personnelle, dans ce navigateur. Les parties partagées et résultats vérifiés par le serveur ont leur propre espace.</p>
    <section className="profile-summary" aria-label="Résumé de progression">
      <div><strong>{formatNumberFr(statistics.totalWins)}</strong><span>{statistics.totalWins === 1 ? "mot trouvé" : "mots trouvés"}</span></div><div><strong>{formatNumberFr(statistics.dailyStreak)}</strong><span>{statistics.dailyStreak === 1 ? "jour" : "jours"} de série quotidienne</span></div><div><strong>{formatNumberFr(level)}</strong><span>niveau · {formatNumberFr(xp)} XP</span></div>
      <p>{formatNumberFr(500 - xp % 500)} XP avant le niveau {formatNumberFr(level + 1)}. +2 XP par proposition, +150 par victoire ; indices sans XP. La série suit les quotidiens à l’heure de Paris, jamais les archives.</p>
    </section>
    {ritual && <WeeklyRitualCard projection={ritual} />}
    <details className="reference-setting profile-details"><summary>Réussites et statistiques détaillées</summary>
      <ul className="profile-milestones">{milestones.map(item => <li key={item.name}><strong>{item.name}</strong><span>{item.done ? "Atteint" : "À atteindre"} · {item.rule}</span></li>)}</ul>
      <p>Statistiques des réussites enregistrées uniquement, sans taux de victoire ni moyenne sur les parties absentes.</p>
      <dl className="profile-measurements"><div><dt>Essais médians</dt><dd>{formatNumberFr(statistics.medianTries)} <small>sur {countLabel(statistics.trialsSample, "réussite renseignée", "réussites renseignées")}</small></dd></div><div><dt>Indices médians</dt><dd>{formatNumberFr(statistics.medianHints)} <small>sur {countLabel(statistics.hintsSample, "réussite renseignée", "réussites renseignées")}</small></dd></div><div><dt>Indices utilisés dans les réussites</dt><dd>{formatNumberFr(statistics.totalHints)} <small>sur {countLabel(statistics.hintsSample, "réussite renseignée", "réussites renseignées")}</small></dd></div></dl>
      <div className="profile-table-scroll" tabIndex={0} role="region" aria-label="Statistiques par mode"><table><caption>Réussites par mode</caption><thead><tr><th scope="col">Mode</th><th scope="col">Réussites</th><th scope="col">Essais médians</th><th scope="col">Indices médians</th></tr></thead><tbody>{statistics.modes.map(mode => <tr key={mode.mode}><th scope="row">{mode.label}</th><td>{formatNumberFr(mode.wins)}</td><td>{formatNumberFr(mode.medianTries)}<small>{countLabel(mode.trialsSample, "réussite renseignée", "réussites renseignées")}</small></td><td>{formatNumberFr(mode.medianHints)}<small>{countLabel(mode.hintsSample, "réussite renseignée", "réussites renseignées")}</small></td></tr>)}</tbody></table></div>
      <h3>Évolution dans le temps</h3><p>{countLabel(statistics.datedWins, "réussite datée", "réussites datées")}. {formatNumberFr(statistics.undatedWins)} sans date de fin exploitable : anciens faits incomplets ou date invalide, exclus de l’évolution. La date de l’énigme ne remplace jamais la date de réussite.</p>
      {statistics.trend.length ? <div className="profile-table-scroll" tabIndex={0} role="region" aria-label="Évolution datée"><table><caption>Les 12 derniers jours avec une réussite datée · Paris</caption><thead><tr><th scope="col">Date de réussite</th><th scope="col">Réussites</th><th scope="col">Essais médians</th></tr></thead><tbody>{statistics.trend.slice(-12).map(day => <tr key={day.date}><th scope="row">{formatDateFr(day.date)}</th><td>{day.wins}</td><td>{formatNumberFr(day.medianTries)}<small>sur {countLabel(day.trialsSample, "réussite renseignée", "réussites renseignées")}</small></td></tr>)}</tbody></table></div> : <p>Pas encore de réussite datée : aucune tendance disponible.</p>}
      <details><summary>Historique personnel ({countLabel(statistics.totalWins, "réussite")})</summary>
        <ol className="profile-history">{statistics.history.slice(0, visibleHistory).map(win => <li key={win.id}><strong>{PERSONAL_MODES.find(mode => mode.mode === win.mode)?.label ?? "Mode inconnu"}</strong><span>{win.completedAt && Number.isFinite(Date.parse(win.completedAt)) && Date.parse(win.completedAt) <= Date.parse(now) ? `Réussi le ${formatDateFr(win.completedAt, true)}` : "Date de réussite inconnue (ancien fait incomplet)"}</span>{["daily", "archive"].includes(win.mode) && <small>Énigme du {formatDateFr(win.date)}</small>}<small>{countLabel(win.tries, "essai")} · {countLabel(win.hints, "indice")}</small></li>)}</ol>
        {visibleHistory < statistics.totalWins && <button className="text-action" type="button" onClick={() => setVisibleHistory(count => count + 50)}>Voir les 50 suivantes</button>}
      </details>
    </details>
    <details className="reference-setting profile-details"><summary>Styles permanents</summary>{ritual && <CosmeticPicker projection={ritual} disabled={busy} onSelect={onCosmetic} />}</details>
    <section className="profile-preferences" aria-labelledby="profile-preferences-title"><h2 id="profile-preferences-title">Préférences</h2>
      <button className="reference-setting" role="switch" aria-checked={profile.sound} disabled={busy} type="button" onClick={() => onSound(!profile.sound)}><span><Volume2 aria-hidden="true" /> Son {profile.sound ? "activé" : "désactivé"}</span><i aria-hidden="true" className={profile.sound ? "ref-switch on" : "ref-switch"} /></button>
      <button className="reference-setting" role="switch" aria-checked={!flamePaused} type="button" onClick={onAnimations}><span><Sparkles aria-hidden="true" /> Animations {!flamePaused ? "activées" : "en pause"}</span><i aria-hidden="true" className={!flamePaused ? "ref-switch on" : "ref-switch"} /></button>
      <CalendarReminderControl />
    </section>
    <details className="reference-setting profile-details"><summary>Vos données · sauvegarde et diagnostic</summary>
      <p>{snapshot.persisted ? `Profil enregistré dans ce navigateur · format v${snapshot.formatVersion}. Les onglets partagent cette progression.` : "Sauvegarde locale indisponible : les éléments de cette session peuvent être perdus au rechargement."}</p>
      {snapshot.backupConfirmed && <p>Une copie brute de l’ancien profil est conservée ici.</p>}
      <ProfileTransfer snapshot={snapshot} onSnapshot={onSnapshot} />
      <DeviceSync snapshot={snapshot} onSnapshot={onDeviceSync ?? onSnapshot} disabled={busy} mergeGuard={deviceSyncGuard} />
      <ProductDiagnostics />
    </details>
  </section>;
}
