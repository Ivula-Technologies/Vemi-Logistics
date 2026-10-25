<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This project uses Next.js 16.3.5. APIs, conventions, and file structure may differ from older versions. Before changing Next.js code, read the relevant version-matched guide in `node_modules/next/dist/docs/` and heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Vemi working notes

- The database is the source of truth for access rules. Every table has row-level security; state changes are RPCs in `supabase/migrations/`. Run `npm run test:db` after any migration change.
- `trips` has a secret column (`driver_token`) and `payments` keeps raw M-Pesa data: never `select("*")` on them through a user session; use `TRIP_COLUMNS` / `PAYMENT_COLUMNS` from `src/lib/trips.ts`.
- Money is whole Kenya shillings (integers). Dates show in East Africa Time (`src/lib/utils.ts`).
- The driver page (`/d/[token]`) and its API routes use the service key and the token only; keep them limited to the one trip.
