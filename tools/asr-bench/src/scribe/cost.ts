/**
 * Cost model, shared by both adapters so the batch-vs-realtime cost comparison
 * is apples to apples.
 *
 * Two wrinkles that matter for short game utterances:
 *
 *  - Card names are ~2 seconds long. Per-hour rates make these look free, but the
 *    keyterm 20-second minimum billing (batch, 100+ keyterms) dominates at that
 *    duration: a 2s clip bills as 20s, a 10x markup. That is exactly the regime
 *    our feature lives in, so the report must not miss it.
 *  - The published keyterm add-on is a flat per-hour rate, not a percentage.
 */

import { PRICING } from '../config.ts';

export type CostBreakdown = {
  costUsd: number;
  billedSeconds: number;
  baseUsd: number;
  keytermUsd: number;
  /** True when the keyterm minimum inflated the bill above actual duration. */
  minimumApplied: boolean;
};

export function computeCost(
  model: string,
  audioSeconds: number,
  keytermCount: number,
): CostBreakdown {
  const perHour = PRICING.perHourUsd[model];
  if (perHour === undefined) {
    throw new Error(`No published rate for model "${model}" — add it to PRICING.`);
  }

  const usingKeyterms = keytermCount > 0;

  // The documented 20-second minimum applies to batch requests with 100+ keyterms.
  const minimumApplies =
    usingKeyterms && keytermCount >= 100 && audioSeconds < PRICING.keytermMinBillableSeconds;
  const billedSeconds = minimumApplies ? PRICING.keytermMinBillableSeconds : audioSeconds;

  const hours = billedSeconds / 3600;
  const baseUsd = hours * perHour;
  const keytermUsd = usingKeyterms ? hours * PRICING.keytermAddOnPerHourUsd : 0;

  return {
    costUsd: baseUsd + keytermUsd,
    billedSeconds,
    baseUsd,
    keytermUsd,
    minimumApplied: minimumApplies,
  };
}
