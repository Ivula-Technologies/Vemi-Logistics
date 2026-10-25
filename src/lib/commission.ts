/** Basis points: 1000 = 10%. Matches private.commission_bps_for() in the database. */
export type CommissionSettings = { commission_bps: number; founding_commission_bps: number };
export type CarrierCommission = { commission_bps: number | null; founding_until: string | null };

export function commissionBps(carrier: CarrierCommission | null, settings: CommissionSettings, now = new Date()) {
  if (carrier?.commission_bps !== null && carrier?.commission_bps !== undefined) return carrier.commission_bps;
  if (carrier?.founding_until && new Date(carrier.founding_until) > now) return settings.founding_commission_bps;
  return settings.commission_bps;
}

/** What the carrier receives for a bid, rounded the same way as the database. */
export function carrierPayout(amount: number, bps: number) {
  return amount - Math.round((amount * bps) / 10000);
}

export function percent(bps: number) {
  return `${(bps / 100).toLocaleString("en", { maximumFractionDigits: 2 })}%`;
}
