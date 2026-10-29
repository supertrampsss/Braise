'use client';
import { useState, type FormEvent } from 'react';
import type { MetricsReport } from '@/lib/metrics-contract';
import { requestJson } from '@/lib/request-json';

const labels: Record<string, string> = { gameOpened: 'Ouverture de jeu', firstGuessAccepted: 'Premier essai accepté', guessAccepted: 'Essai accepté', guessRejected: 'Essai refusé', networkFailed: 'Erreur réseau', hintUsed: 'Indice utilisé', puzzleWon: 'Mot trouvé', gameResumed: 'Partie reprise', helpOpened: 'Aide ouverte', summaryOpened: 'Bilan ouvert', shareCopied: 'Résultat copié', shareNative: 'Partage natif confirmé', nextActivityOpened: 'Partie suivante ouverte', duelCreated: 'Duel créé', duelJoined: 'Duel accepté', duelCompleted: 'Fin de duel observée', duelRematchCreated: 'Revanche créée', serviceUnavailable: 'Service indisponible', requestTimedOut: 'Délai réseau dépassé' };
const ratio = (returned: number, eligible: number) => eligible === 0 ? 'n/d' : `${returned}/${eligible} (${Math.round(returned / eligible * 100)} %)`;
const modes: Record<string, string> = { daily: 'Mot du jour', archive: 'Archives', free: 'Partie libre', challenge: 'Défi', collection: 'Collection', expedition: 'Expédition', intruder: 'Intrus', 'two-braises': 'Deux braises', circle: 'Cercle', duel: 'Duel', studio: 'Studio', training: 'Entraînement', offline: 'Hors connexion', profile: 'Profil' };
export function MetricsDashboard() {
  const [report, setReport] = useState<MetricsReport | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, token = String(new FormData(form).get('operator') ?? '');
    form.reset(); setBusy(true); setError(''); setReport(null);
    try {
      const { response, data } = await requestJson<MetricsReport>('/api/metrics', { cache: 'no-store', credentials: 'omit', headers: { Authorization: `Bearer ${token}` }, referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Accès refusé ou accès expiré.' : 'Mesure indisponible. Vérifier la migration et la liaison D1.');
      setReport(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mesure indisponible.'); }
    finally { setBusy(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `braiz-mesure-${report.through}.json`; anchor.click(); URL.revokeObjectURL(url);
  }
  return <main className="metrics-dashboard">
    <h1>Mesure BRAIZ</h1>
    <p>Accès opérateur. Le secret reste uniquement en mémoire pendant la demande.</p>
    <form className="metrics-access" onSubmit={load}><label htmlFor="operator-token">Secret opérateur</label> <input id="operator-token" name="operator" type="password" required minLength={64} maxLength={512} autoComplete="off" spellCheck={false} /> <button type="submit" disabled={busy}>{busy ? 'Chargement…' : 'Consulter'}</button></form>
    {error && <p role="alert">{error}</p>}
    {report && <section aria-live="polite">
      <h2>Du {report.from} au {report.through}</h2><p>{report.scope}</p>
      <p className="metrics-kpis"><span><strong>{report.browsers}</strong> navigateurs observés</span><span><strong>{report.events}</strong> événements reçus</span></p>
      <button type="button" onClick={download}>Exporter les agrégats</button> <button type="button" onClick={() => setReport(null)}>Fermer</button>
      <h2>Activité quotidienne</h2>
      {report.daily.length ? <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Jour</th><th>Navigateurs</th><th>Événements</th></tr></thead><tbody>{report.daily.map(row => <tr key={row.day}><td>{row.day}</td><td>{row.browsers}</td><td>{row.events}</td></tr>)}</tbody></table></div> : <p>Aucune observation disponible. Aucun résultat ne peut encore être conclu.</p>}
      <h2>Actions par mode</h2><div style={{ overflowX: 'auto' }}><table><thead><tr><th>Action</th><th>Mode</th><th>Navigateurs</th><th>Événements</th></tr></thead><tbody>{report.actions.map(row => <tr key={`${row.type}-${row.context}`}><td>{labels[row.type] ?? row.type}</td><td>{modes[row.context] ?? row.context}</td><td>{row.browsers}</td><td>{row.events}</td></tr>)}</tbody></table></div>
      <h2>Retours des cohortes observées</h2><div style={{ overflowX: 'auto' }}><table><thead><tr><th>Première activité</th><th>Navigateurs</th><th>J1</th><th>J7</th></tr></thead><tbody>{report.cohorts.map(row => <tr key={row.day}><td>{row.day}</td><td>{row.browsers}</td><td>{ratio(row.d1Returned, row.d1Eligible)}</td><td>{ratio(row.d7Returned, row.d7Eligible)}</td></tr>)}</tbody></table></div>
      <h2>Périmètre de lecture</h2><ul>{report.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
    </section>}
  </main>;
}
