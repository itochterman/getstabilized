import { LISTING_CHANNEL, newListenClient, type ListingEvent } from "@getstabilized/db";

type Subscriber = (e: ListingEvent) => void;

interface Hub {
  subs: Set<Subscriber>;
  connecting: Promise<void> | null;
  connected: boolean;
}

// One Postgres LISTEN connection per server process, shared by every open browser stream.
const g = globalThis as unknown as { __getstabilizedHub?: Hub };
const hub: Hub = (g.__getstabilizedHub ??= { subs: new Set(), connecting: null, connected: false });

function connect(): Promise<void> {
  if (hub.connected || hub.connecting) return hub.connecting ?? Promise.resolve();
  hub.connecting = (async () => {
    const client = newListenClient();
    const fail = () => {
      hub.connected = false;
      hub.connecting = null;
      client.removeAllListeners();
      client.end().catch(() => {});
      // Reconnect while anyone is still listening.
      if (hub.subs.size > 0) setTimeout(() => connect().catch(() => {}), 3000);
    };
    client.on("error", fail);
    client.on("end", fail);
    client.on("notification", (msg) => {
      if (!msg.payload) return;
      try {
        const e = JSON.parse(msg.payload) as ListingEvent;
        for (const s of hub.subs) s(e);
      } catch {
        /* ignore malformed payloads */
      }
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${LISTING_CHANNEL}`);
      hub.connected = true;
    } catch (e) {
      fail();
      throw e;
    } finally {
      hub.connecting = null;
    }
  })();
  return hub.connecting;
}

export async function subscribe(fn: Subscriber): Promise<() => void> {
  hub.subs.add(fn);
  await connect().catch(() => {});
  return () => {
    hub.subs.delete(fn);
  };
}
