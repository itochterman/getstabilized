import { CITIES, type ListingContact, type ListingDTO } from "@getstabilized/core";
import { BuildingArt } from "./BuildingArt";
import { bedLabel, money, TIER_COLOR, tierPhrase } from "./format";

/** Full explanation of one listing. Used in the modal sheet and on /listing/[id]. */
export function ListingDetail({ l, onClose }: { l: ListingDTO; onClose?: () => void }) {
  const city = CITIES[l.city];
  // The newest history entry is usually this listing itself; "Now" already shows it.
  const recent = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const history = l.priceHistory.filter((h) => h.date < recent);
  return (
    <>
      <BuildingArt l={l}>
        <div className="tag"><span>{l.yearBuilt ? `Built ${l.yearBuilt}` : "Year unknown"}</span></div>
      </BuildingArt>
      {onClose && (
        <button className="close" type="button" onClick={onClose} aria-label="Close">×</button>
      )}
      <div className="sheet-in">
        <div>
          <div className="price">{money(l.rent, true)}<small> /mo</small></div>
          <h2 id="sheet-title">{l.title}</h2>
          <div className="where">
            {l.address}{l.neighborhood ? ` · ${l.neighborhood}` : ""}, {city.name}{l.noFee ? " · No fee" : ""}
          </div>
        </div>
        <div className={`verdict ${l.tier}`}>
          <div className="meter" style={{ ["--p" as string]: l.score, ["--c" as string]: TIER_COLOR[l.tier] } as React.CSSProperties}>
            <span>{l.score}</span>
          </div>
          <div>
            <b>{tierPhrase(l.tier, l.city)}</b>
            <span className="s">Our estimate out of 99, based on the clues below.</span>
          </div>
        </div>
        <div>
          <p className="h">Why</p>
          <ul className="reasons">
            {l.reasons.map((r) => (
              <li key={r.code + r.text}>
                <span className={`ic ${r.direction}`} aria-hidden="true">{r.direction === "up" ? "✓" : r.direction === "down" ? "✕" : "?"}</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="facts">
          <div><b>{bedLabel(l.beds)}</b><span>{l.sqft ? `${l.sqft.toLocaleString()} sq ft` : "Size"}</span></div>
          <div><b>{l.yearBuilt ?? "?"}</b><span>Year built</span></div>
          <div><b>{l.units ?? "?"}</b><span>Units in building</span></div>
        </div>
        {l.description && (
          <div>
            <p className="h">From the listing</p>
            <p className="quote">{l.description}</p>
          </div>
        )}
        {l.contacts.length > 0 && (
          <div>
            <p className="h">Contact</p>
            <div className="contacts">
              {l.contacts.map((c) => <ContactCard key={c.role + (c.name ?? "")} c={c} />)}
            </div>
          </div>
        )}
        {history.length > 0 && (
          <div>
            <p className="h">Rent history for this unit</p>
            <ul className="history">
              {history.slice(-6).reverse().map((h) => (
                <li key={h.date + h.price}>
                  <span>{new Date(h.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  <b>{money(h.price, true)}</b>
                </li>
              ))}
              <li className="now"><span>Now</span><b>{money(l.rent, true)}</b></li>
            </ul>
          </div>
        )}
        <a className="check" href={city.agency.url} target="_blank" rel="noopener noreferrer">
          Confirm with the {city.agency.name} ↗
        </a>
        {l.url && (
          <a className="check alt" href={l.url} target="_blank" rel="noopener noreferrer">View original listing ↗</a>
        )}
        <p className="src">
          {l.buildingMatched ? "Building facts from public property records." : "No property record matched yet; building facts come from the listing."}{" "}
          Source: {l.source === "rentcast" ? "RentCast" : l.source}{l.mlsNumber ? `, MLS #${l.mlsNumber}` : ""}{l.daysOnMarket != null ? `, ${l.daysOnMarket} days on market` : ""}.
        </p>
      </div>
    </>
  );
}

const ROLE_LABEL: Record<ListingContact["role"], string> = { agent: "Listing agent", office: "Brokerage", builder: "Builder" };

function formatPhone(p: string) {
  const d = p.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : p;
}

function ContactCard({ c }: { c: ListingContact }) {
  const site = c.website ? (/^https?:\/\//i.test(c.website) ? c.website : `https://${c.website}`) : null;
  return (
    <div className="contact">
      <span className="role">{ROLE_LABEL[c.role]}</span>
      {c.name && <b>{c.name}</b>}
      {c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{formatPhone(c.phone)}</a>}
      {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
      {site && <a href={site} target="_blank" rel="noopener noreferrer">{site.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}</a>}
    </div>
  );
}
