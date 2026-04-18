export type StreamInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
};

export async function* streamNdjson<T>(url: string, init: StreamInit): AsyncIterable<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "POST",
      headers: init.headers,
      body: init.body,
      signal: init.signal,
    });
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") return;
    yield synthDegradation("Network unreachable — response not received.") as T;
    return;
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    yield synthDegradation(
      `Upstream ${res.status} — ${text.slice(0, 200) || res.statusText || "no body"}`,
    ) as T;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line) as T;
        } catch {
          // skip malformed line; backend is source of truth and every real event is JSON
        }
      }
    }
    const tail = (buf + decoder.decode()).trim();
    if (tail) {
      try {
        yield JSON.parse(tail) as T;
      } catch {
        // drop trailing garbage
      }
    }
  } catch (err) {
    if ((err as { name?: string }).name !== "AbortError") {
      yield synthDegradation("Stream interrupted mid-response.") as T;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

const synthDegradation = (reason: string): {
  type: "degradation";
  mode: "offline";
  reason: string;
  notice_en: string;
  notice_fr: string;
} => ({
  type: "degradation",
  mode: "offline",
  reason,
  notice_en: "Connection to the assistant was interrupted. Try again.",
  notice_fr: "La connexion à l'assistant a été interrompue. Veuillez réessayer.",
});
