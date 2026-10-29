'use client';
import { useEffect } from 'react';
import { initializeMetrics } from '@/lib/metrics-client';

/** Restores only pending revocation, never consent or historical events. No request/identifier when off. */
export function MetricsLifecycle() {
  useEffect(() => { try { initializeMetrics(localStorage); } catch { /* Unavailable browser storage keeps measurement off. */ } }, []);
  return null;
}
