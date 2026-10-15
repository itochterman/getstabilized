import { CITIES, formatMoney, type CityId, type Tier } from "@getstabilized/core";

export const TIER_LABEL: Record<Tier, string> = { likely: "Likely", maybe: "Maybe", unlikely: "Unlikely" };
export const TIER_COLOR: Record<Tier, string> = { likely: "var(--yes)", maybe: "var(--maybe)", unlikely: "var(--no)" };

export const bedLabel = (b: number) => (b === 0 ? "Studio" : `${b} bed`);
export const money = formatMoney;

export function tierPhrase(tier: Tier, city: CityId) {
  return `${TIER_LABEL[tier]} ${CITIES[city].term}`;
}

export function firstSentence(t: string) {
  const i = t.indexOf(". ");
  return (i > 0 ? t.slice(0, i) : t).replace(/\.$/, "");
}

export const HEART_PATH =
  "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.4h2c.7-1.2 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z";
