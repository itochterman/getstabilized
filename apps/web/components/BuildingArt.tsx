import type { ListingDTO } from "@getstabilized/core";

/** A small skyline drawn from building facts: older buildings get warm masonry, newer ones glass. */
export function BuildingArt({ l, children }: { l: Pick<ListingDTO, "yearBuilt" | "units" | "propertyType">; children?: React.ReactNode }) {
  const year = l.yearBuilt ?? 1960;
  const old = year < 1950;
  const mid = year < 1980;
  const wall = old ? "#B5654A" : mid ? "#C9A27A" : "#5E7896";
  const win = old ? "#F6DFA9" : mid ? "#FFF2CF" : "#BFE3FF";
  const sky = old ? "linear-gradient(#F7C59F,#F3E3C9)" : mid ? "linear-gradient(#BFD8F0,#E7F0FA)" : "linear-gradient(#9DB7E8,#DDE6F7)";
  const u = l.units ?? 8;
  const h = Math.min(92, 30 + Math.log2(u + 1) * 9);
  const w = l.propertyType === "single_family" ? 32 : Math.min(56, 26 + Math.log2(u + 1) * 4);
  const style = (left: number, width: number, height: number) =>
    ({ left: `${left}%`, ["--w" as string]: `${width}%`, ["--h" as string]: `${height}%`, ["--wall" as string]: wall, ["--win" as string]: win }) as React.CSSProperties;
  return (
    <div className="art" style={{ ["--sky" as string]: sky } as React.CSSProperties} aria-hidden={children ? undefined : true}>
      <div className="bld side" style={style(18, 22, h * 0.7)} />
      <div className="bld side" style={style(82, 20, h * 0.55)} />
      <div className="bld" style={style(50, w, h)} />
      {children}
    </div>
  );
}
