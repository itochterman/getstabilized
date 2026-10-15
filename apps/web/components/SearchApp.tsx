"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CITIES, CITY_IDS, matchesFilters, type CityId, type ListingDTO, type SearchFilters, type SortKey } from "@getstabilized/core";
import { ListingCard } from "./ListingCard";
import { ListingDetail } from "./ListingDetail";
import { bedLabel, HEART_PATH, money } from "./format";

interface Results {
  listings: ListingDTO[];
  total: number;
  likely: number;
}

const PAGE = 60;
const SAVED_KEY = "getstabilized-saved";

function readSaved(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

function toQuery(f: SearchFilters, sort: SortKey, offset = 0) {
  const p = new URLSearchParams({ city: f.city, sort, limit: String(PAGE), offset: String(offset) });
  if (f.beds != null) p.set("beds", String(f.beds));
  if (f.maxRent != null) p.set("maxRent", String(f.maxRent));
  if (f.likelyOnly) p.set("likelyOnly", "true");
  if (f.noFee) p.set("noFee", "true");
  if (f.hideExempt) p.set("hideExempt", "true");
  return p.toString();
}

const shortTerm = (city: CityId) => CITIES[city].term;

export function SearchApp({ initial, initialCity }: { initial: Results | null; initialCity: CityId }) {
  const [city, setCity] = useState<CityId>(initialCity);
  const [beds, setBeds] = useState<number | null>(null);
  const [maxRent, setMaxRent] = useState<number | null>(null);
  const [likelyOnly, setLikelyOnly] = useState(false);
  const [noFee, setNoFee] = useState(false);
  const [hideExempt, setHideExempt] = useState(false);
  const [sort, setSort] = useState<SortKey>("best");

  const [results, setResults] = useState<Results | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initial ? null : "Search is unavailable right now. Check that the database is running.");
  const [pending, setPending] = useState<ListingDTO[]>([]);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [live, setLive] = useState(false);

  const [saved, setSaved] = useState<number[]>([]);
  const [savedView, setSavedView] = useState<ListingDTO[] | null>(null);
  const [open, setOpen] = useState<ListingDTO | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  const filters: SearchFilters = useMemo(
    () => ({ city, beds, maxRent, likelyOnly, noFee, hideExempt }),
    [city, beds, maxRent, likelyOnly, noFee, hideExempt],
  );
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const first = useRef(true);

  useEffect(() => setSaved(readSaved()), []);

  // Search whenever filters or sort change. The server already rendered the first page.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setPending([]);
    fetch(`/api/listings?${toQuery(filters, sort)}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Search failed.");
        setResults(body);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message || "Search failed.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [filters, sort]);

  // Live updates: one stream per city. New matches wait in a "show new" pill so the grid doesn't jump.
  useEffect(() => {
    const es = new EventSource(`/api/stream?city=${city}`);
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.addEventListener("listing", (ev) => {
      const l = JSON.parse((ev as MessageEvent).data) as ListingDTO;
      if (!matchesFilters(l, filtersRef.current)) return;
      setPending((p) => (p.some((x) => x.id === l.id) ? p : [l, ...p]));
    });
    return () => {
      es.close();
      setLive(false);
    };
  }, [city]);

  const showPending = () => {
    setResults((r) => {
      const base = r ?? { listings: [], total: 0, likely: 0 };
      const fresh = pending.filter((p) => !base.listings.some((l) => l.id === p.id));
      return {
        listings: [...fresh, ...base.listings],
        total: base.total + fresh.length,
        likely: base.likely + fresh.filter((l) => l.tier === "likely").length,
      };
    });
    setNewIds((s) => new Set([...s, ...pending.map((p) => p.id)]));
    setPending([]);
    window.scrollTo({ top: document.getElementById("results")?.offsetTop ?? 0, behavior: "smooth" });
  };

  const loadMore = async () => {
    if (!results) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/listings?${toQuery(filters, sort, results.listings.length)}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setResults({ ...body, listings: [...results.listings, ...body.listings] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load more.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = useCallback((id: number) => {
    setSaved((s) => {
      const next = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep in memory */
      }
      return next;
    });
  }, []);

  const openSaved = async () => {
    if (savedView) return setSavedView(null);
    const ids = readSaved();
    if (ids.length === 0) return setSavedView([]);
    const r = await fetch(`/api/listings?ids=${ids.join(",")}`);
    const body = await r.json();
    setSavedView(r.ok ? body.listings : []);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setAlertOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = shortTerm(city);
  const list = savedView ?? results?.listings ?? [];

  return (
    <>
      <header className="hero">
        <div className="wrap">
          <div className="top">
            <a className="logo" href="/">
              <i>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="1" y="7" width="4" height="8" rx="1" fill="#2B39D8" />
                  <rect x="6" y="3" width="4" height="12" rx="1" fill="#10185A" />
                  <rect x="11" y="1" width="4" height="14" rx="1" fill="#2B39D8" />
                </svg>
              </i>
              GetStabilized
            </a>
            <div className="top-actions">
              <span className={`live${live ? "" : " off"}`} title={live ? "Receiving new listings as they arrive" : "Live updates paused"}>
                <i /> <span>{live ? "Live" : "Offline"}</span>
              </span>
              <button className="ghost" type="button" onClick={openSaved} aria-pressed={savedView !== null}>
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={HEART_PATH} /></svg>
                {savedView ? "All listings" : `Saved${saved.length ? ` (${saved.length})` : ""}`}
              </button>
            </div>
          </div>
          <h1>{savedView ? "Your saved apartments." : `Find ${term} apartments in ${CITIES[city].name}.`}</h1>
          <form className="search" onSubmit={(e) => { e.preventDefault(); setSavedView(null); }}>
            <div className="sf">
              <label htmlFor="city">City</label>
              <select id="city" value={city} onChange={(e) => { setCity(e.target.value as CityId); setSavedView(null); setNewIds(new Set()); }}>
                {CITY_IDS.map((id) => <option key={id} value={id}>{CITIES[id].name}</option>)}
              </select>
            </div>
            <div className="sf">
              <label htmlFor="beds">Bedrooms</label>
              <select id="beds" value={beds ?? "any"} onChange={(e) => setBeds(e.target.value === "any" ? null : Number(e.target.value))}>
                <option value="any">Any</option>
                <option value="0">Studio</option>
                <option value="1">1 bed</option>
                <option value="2">2 beds</option>
                <option value="3">3+ beds</option>
              </select>
            </div>
            <div className="sf">
              <label htmlFor="budget">Budget</label>
              <select id="budget" value={maxRent ?? "any"} onChange={(e) => setMaxRent(e.target.value === "any" ? null : Number(e.target.value))}>
                <option value="any">Any</option>
                {[2000, 2500, 3000, 3500, 4000, 5000].map((n) => <option key={n} value={n}>Under {money(n)}</option>)}
              </select>
            </div>
            <button className="go" type="submit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              Search
            </button>
          </form>
        </div>
      </header>

      <main className="wrap" id="results">
        {!savedView && (
          <div className="bar">
            <div className="chips">
              <button className="chip" type="button" aria-pressed={likelyOnly} onClick={() => setLikelyOnly(!likelyOnly)}><span className="dot" />Likely only</button>
              <button className="chip" type="button" aria-pressed={noFee} onClick={() => setNoFee(!noFee)}>No fee</button>
              <button className="chip" type="button" aria-pressed={hideExempt} onClick={() => setHideExempt(!hideExempt)}>Hide condos and houses</button>
              <button className="chip alert-chip" type="button" onClick={() => setAlertOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
                Get alerts
              </button>
            </div>
            <div className="sort" role="group" aria-label="Sort">
              {([["best", "Best"], ["cheap", "Cheapest"], ["likely", "Most likely"], ["newest", "Newest"]] as const).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>
              ))}
            </div>
          </div>
        )}

        <div className="count" aria-live="polite">
          {savedView ? (
            <span><b>{savedView.length} saved</b></span>
          ) : results ? (
            <span><b>{results.total} apartments</b> · {results.likely} likely {term}</span>
          ) : null}
          {!savedView && pending.length > 0 && (
            <button className="fresh" type="button" onClick={showPending}>
              ↑ {pending.length} new listing{pending.length > 1 ? "s" : ""}
            </button>
          )}
        </div>

        <div className={`grid${loading ? " loading" : ""}`}>
          {error && !savedView ? (
            <div className="empty err"><b>Something went wrong</b>{error}</div>
          ) : list.length === 0 ? (
            <div className="empty">
              <b>{savedView ? "Nothing saved yet" : "No apartments match"}</b>
              {savedView ? "Tap the heart on any listing to keep it here." : "Try a higher budget or turn off a filter."}
            </div>
          ) : (
            list.map((l) => (
              <ListingCard
                key={l.id}
                l={l}
                saved={saved.includes(l.id)}
                isNew={newIds.has(l.id)}
                showCity={savedView !== null}
                onOpen={() => setOpen(l)}
                onToggleSave={() => toggleSave(l.id)}
              />
            ))
          )}
        </div>
        {!savedView && results && results.listings.length < results.total && (
          <div className="more">
            <button className="btn-secondary" type="button" onClick={loadMore} disabled={loading}>Show more</button>
          </div>
        )}
        <p className="foot">
          GetStabilized estimates each apartment's chance of rent regulation from three clues: an uneven rent (capped yearly increases rarely land on round numbers), what the listing says, and the building's age and size from public property records. It's an estimate. Only the city's rent agency can confirm a unit's status.
        </p>
      </main>

      {open && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <ListingDetail l={open} onClose={() => setOpen(null)} />
          </div>
        </div>
      )}

      {alertOpen && <AlertDialog filters={filters} onClose={() => setAlertOpen(false)} />}
    </>
  );
}

function AlertDialog({ filters, onClose }: { filters: SearchFilters; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const parts = [
    CITIES[filters.city].name,
    filters.beds == null ? "any size" : filters.beds >= 3 ? "3+ beds" : bedLabel(filters.beds),
    filters.maxRent ? `under ${money(filters.maxRent)}` : "any budget",
    filters.likelyOnly && "likely only",
    filters.noFee && "no fee",
    filters.hideExempt && "no condos or houses",
  ].filter(Boolean);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("saving");
    try {
      const r = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, filters }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setState("done");
      setMsg("Alert saved. New matches will be sent to " + email + ".");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Couldn't save the alert. Try again.");
    }
  };

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="alert-title">
        <button className="close" type="button" onClick={onClose} aria-label="Close">×</button>
        <form className="form" onSubmit={submit}>
          <h2 id="alert-title">Get alerts for this search</h2>
          <p>We'll email you when a new listing matches.</p>
          <div className="summary">{parts.join(" · ")}</div>
          <div>
            <label htmlFor="alert-email">Email</label>
            <input id="alert-email" ref={inputRef} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          {msg && <div className={`msg ${state === "error" ? "err" : "ok"}`} role="status">{msg}</div>}
          <div className="row">
            {state === "done" ? (
              <button className="btn" type="button" onClick={onClose}>Done</button>
            ) : (
              <button className="btn" type="submit" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save alert"}</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
