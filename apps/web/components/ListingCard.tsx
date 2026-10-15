import { CITIES, type ListingDTO } from "@getstabilized/core";
import { BuildingArt } from "./BuildingArt";
import { bedLabel, firstSentence, HEART_PATH, money, tierPhrase } from "./format";

interface Props {
  l: ListingDTO;
  saved: boolean;
  isNew: boolean;
  showCity: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}

export function ListingCard({ l, saved, isNew, showCity, onOpen, onToggleSave }: Props) {
  const lead = l.reasons[0];
  return (
    <article
      className={`card${isNew ? " is-new" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`${l.title}, ${money(l.rent)} a month, ${tierPhrase(l.tier, l.city)}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <BuildingArt l={l}>
        <div className="tag">
          {isNew && <span className="new">New</span>}
          <span>{l.yearBuilt ? `Built ${l.yearBuilt}` : "Year unknown"}</span>
        </div>
      </BuildingArt>
      <button
        className="fav"
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSave();
        }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={HEART_PATH} /></svg>
      </button>
      <div className="body">
        <div className="price">{money(l.rent)}<small> /mo</small></div>
        <div className="where">
          {bedLabel(l.beds)} · {l.neighborhood ?? l.address}{showCity ? `, ${CITIES[l.city].name}` : ""}
        </div>
        <span className={`badge ${l.tier}`}><i />{tierPhrase(l.tier, l.city)}</span>
        {lead && <div className="why">{firstSentence(lead.text)}</div>}
      </div>
    </article>
  );
}
