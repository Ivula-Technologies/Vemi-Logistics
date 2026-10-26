import { COUNTRY_NAMES } from "@/lib/pricing";
import { selectClass } from "@/components/app/field";
import type { PlaceRow } from "@/lib/types";

/** A plain select grouped by country: fast on cheap phones and works before JavaScript loads. */
export function PlaceSelect({ id, name, places, value, defaultValue, onChange, required }: { id: string; name: string; places: PlaceRow[]; value?: string; defaultValue?: string; onChange?: (value: string) => void; required?: boolean }) {
  const countries = [...new Set(places.map((p) => p.country))];
  return <select id={id} name={name} className={selectClass} value={value} defaultValue={value === undefined ? defaultValue ?? "" : undefined} onChange={onChange ? (e) => onChange(e.target.value) : undefined} required={required}>
    <option value="" disabled>Choose a town or border</option>
    {countries.map((country) => <optgroup key={country} label={COUNTRY_NAMES[country] ?? country}>
      {places.filter((p) => p.country === country).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </optgroup>)}
  </select>;
}
