import { METRICS_DAILY_CAP, METRICS_LIFETIME_MS, METRICS_RETENTION_DAYS, type MetricEvent, type MetricsReport } from './metrics-contract';

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
export const metricDay = (now: number) => dayFormatter.format(new Date(now));
const nextDay = (day: string, offset: number) => new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

export class MetricsStore {
  constructor(private db: D1Database) {}
  /** Called before every read/write. Expired records are never included in reports. */
  async prune(now: number) {
    await this.db.batch([
      // Every event expires with its consent (at most 35 days). Use indexed expiry/token lookups, never scan all events on each guess.
      this.db.prepare('DELETE FROM braiz_metric_events WHERE token_hash IN (SELECT token_hash FROM braiz_metric_consents WHERE expires_at<=?)').bind(now),
      this.db.prepare('DELETE FROM braiz_metric_consents WHERE expires_at<=?').bind(now),
    ]);
  }
  async grant(hash: string, now: number): Promise<number | null> {
    // A revoked token is a tombstone until its original expiry: a delayed grant cannot resurrect consent.
    await this.db.prepare('INSERT OR IGNORE INTO braiz_metric_consents(token_hash,granted_at,expires_at,revoked) SELECT ?,?,?,0 WHERE (SELECT COUNT(*) FROM braiz_metric_consents WHERE revoked=0)<10000').bind(hash, now, now + METRICS_LIFETIME_MS).run();
    const row = await this.db.prepare('SELECT expires_at FROM braiz_metric_consents WHERE token_hash=? AND revoked=0 AND expires_at>?').bind(hash, now).first<{ expires_at: number }>();
    return row?.expires_at ?? null;
  }
  async revoke(hash: string, now: number) {
    await this.db.batch([
      this.db.prepare('INSERT INTO braiz_metric_consents(token_hash,granted_at,expires_at,revoked) SELECT ?,?,?,1 WHERE (SELECT COUNT(*) FROM braiz_metric_consents WHERE revoked=1)<10000 OR EXISTS(SELECT 1 FROM braiz_metric_consents WHERE token_hash=?) ON CONFLICT(token_hash) DO UPDATE SET revoked=1').bind(hash, now, now + METRICS_LIFETIME_MS, hash),
      this.db.prepare('DELETE FROM braiz_metric_events WHERE token_hash=?').bind(hash),
    ]);
    if (!await this.db.prepare('SELECT token_hash FROM braiz_metric_consents WHERE token_hash=? AND revoked=1').bind(hash).first()) throw new Error('revocation-capacity');
  }
  async known(hash: string) { return !!await this.db.prepare('SELECT token_hash FROM braiz_metric_consents WHERE token_hash=?').bind(hash).first(); }
  async collect(hash: string, event: MetricEvent, now: number) {
    const result = await this.db.prepare(`INSERT OR IGNORE INTO braiz_metric_events(token_hash,event_id,day,type,context,received_at)
      SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM braiz_metric_consents WHERE token_hash=? AND revoked=0 AND expires_at>?)
      AND (SELECT COUNT(*) FROM braiz_metric_events WHERE token_hash=? AND day=?)<?`)
      .bind(hash, event.id, metricDay(now), event.type, event.context, now, hash, now, hash, metricDay(now), METRICS_DAILY_CAP).run();
    return result.meta.changes > 0;
  }
  async report(now: number): Promise<MetricsReport> {
    await this.prune(now);
    const through = metricDay(now), from = nextDay(through, -(METRICS_RETENTION_DAYS - 1));
    const predicate = 'e.day>=? AND e.day<=? AND c.revoked=0 AND c.expires_at>?';
    const joined = 'FROM braiz_metric_events e JOIN braiz_metric_consents c ON c.token_hash=e.token_hash';
    const [totals, daily, actions, cohortDays] = await Promise.all([
      this.db.prepare(`SELECT COUNT(DISTINCT e.token_hash) AS browsers, COUNT(*) AS events ${joined} WHERE ${predicate}`).bind(from, through, now).first<{ browsers: number; events: number }>(),
      this.db.prepare(`SELECT e.day,COUNT(DISTINCT e.token_hash) AS browsers,COUNT(*) AS events ${joined} WHERE ${predicate} GROUP BY e.day ORDER BY e.day`).bind(from, through, now).all<MetricsReport['daily'][number]>(),
      this.db.prepare(`SELECT e.type,e.context,COUNT(DISTINCT e.token_hash) AS browsers,COUNT(*) AS events ${joined} WHERE ${predicate} GROUP BY e.type,e.context ORDER BY e.type,e.context`).bind(from, through, now).all<MetricsReport['actions'][number]>(),
      // Cohort entry is the first observed play action, never the date of consent or a help-page visit.
      this.db.prepare(`WITH active AS (SELECT DISTINCT e.token_hash,e.day ${joined} WHERE ${predicate} AND e.type IN ('gameOpened','guessAccepted','gameResumed','duelCreated','duelJoined')), firsts AS (SELECT token_hash,MIN(day) AS day FROM active GROUP BY token_hash)
        SELECT f.day,COUNT(*) AS browsers,
        SUM(CASE WHEN EXISTS(SELECT 1 FROM active a WHERE a.token_hash=f.token_hash AND a.day=date(f.day,'+1 day')) THEN 1 ELSE 0 END) AS d1Returned,
        SUM(CASE WHEN EXISTS(SELECT 1 FROM active a WHERE a.token_hash=f.token_hash AND a.day=date(f.day,'+7 day')) THEN 1 ELSE 0 END) AS d7Returned
        FROM firsts f GROUP BY f.day ORDER BY f.day`).bind(from, through, now).all<{ day: string; browsers: number; d1Returned: number; d7Returned: number }>(),
    ]);
    return {
      generatedAt: new Date(now).toISOString(), from, through,
      scope: 'Navigateurs ayant accepté la mesure, pendant leur période de consentement. Pas une estimation de tous les joueurs.',
      limits: [`Fenêtre de ${METRICS_RETENTION_DAYS} jours. Jour de réception Europe/Paris; aucun rattrapage hors connexion.`, `Au plus ${METRICS_DAILY_CAP} événements par navigateur et par jour. Les blocages réseau, refus, révocations et expirations réduisent les observations.`, 'J1 et J7 : retour un jour ou sept jours calendaires après la première activité de jeu observée. Seuls les jours de retour terminés entrent dans le dénominateur.', 'Un navigateur peut représenter plusieurs personnes; plusieurs navigateurs peuvent représenter la même personne. Aucune liaison avec les comptes.', 'Les erreurs sont des signalements clients volontaires; elles ne mesurent pas la disponibilité globale du service.'],
      browsers: totals?.browsers ?? 0, events: totals?.events ?? 0,
      daily: daily.results, actions: actions.results,
      cohorts: cohortDays.results.map(row => ({ ...row, d1Eligible: nextDay(row.day, 1) < through ? row.browsers : 0, d7Eligible: nextDay(row.day, 7) < through ? row.browsers : 0 })),
    };
  }
}
