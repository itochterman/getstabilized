import { CITIES, type ListingDTO } from "@getstabilized/core";
import { BuildingArt } from "./BuildingArt";
import { bedLabel, money, TIER_COLOR, tierPhrase } from "./format";

/** Full explanation of one listing. Used in the modal sheet and on /listing/[id]. */
export function ListingDetail({ l, onClose }: { l: ListingDTO; onClose?: () => void }) {
  const city = CITIES[l.city];
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
        <a className="check" href={city.agency.url} target="_blank" rel="noopener noreferrer">
          Confirm with the {city.agency.name} ↗
        </a>
        {l.url && (
          <a className="check alt" href={l.url} target="_blank" rel="noopener noreferrer">View original listing ↗</a>
        )}
        <p className="src">
          {l.buildingMatched ? "Building facts from public property records." : "No property record matched yet; building facts come from the listing."} Source: {l.source}.
        </p>
      </div>
    </>
  );
}
