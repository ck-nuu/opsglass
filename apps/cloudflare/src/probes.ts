import type { Check, Health } from "@repo/registry";
export type Observation = {
  status: Health;
  latency: number | null;
  message: string;
};
type DNSAnswer = { type: number; data: string };
export function publicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    /^[a-z0-9.-]+$/.test(host) &&
    host.includes(".") &&
    !/^\d+(\.\d+){3}$/.test(host) &&
    !host.endsWith(".localhost") &&
    !host.endsWith(".local") &&
    !host.endsWith(".internal") &&
    !host.endsWith(".ts.net") &&
    !host.endsWith(".arpa")
  );
}
export function publicAddress(address: string): boolean {
  if (address.includes(":")) {
    const ip = address.toLowerCase();
    return (
      !ip.startsWith("::") &&
      !ip.startsWith("fc") &&
      !ip.startsWith("fd") &&
      !ip.startsWith("fe8") &&
      !ip.startsWith("fe9") &&
      !ip.startsWith("fea") &&
      !ip.startsWith("feb") &&
      !ip.startsWith("ff")
    );
  }
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  const [a, b] = octets;
  return (
    a !== 0 &&
    a !== 10 &&
    a !== 127 &&
    a < 224 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && b === 168) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && [18, 19].includes(b))
  );
}
export async function dnsQuery(
  host: string,
  type: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`,
    { headers: { accept: "application/dns-json" }, signal },
  );
  if (!response.ok) throw new Error(`DNS resolver returned ${response.status}`);
  return (await response.json()) as { Status: number; Answer?: DNSAnswer[] };
}
async function safeHttpTarget(
  target: string,
  signal: AbortSignal,
  fetcher: typeof fetch,
) {
  const url = new URL(target);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    !publicHostname(url.hostname)
  )
    throw new Error(
      "Private addresses, credentials, and nonstandard ports require a local collector.",
    );
  const addresses = await Promise.all(
    ["A", "AAAA"].map((type) => dnsQuery(url.hostname, type, signal, fetcher)),
  );
  const records = addresses
    .flatMap((r) => r.Answer || [])
    .filter((r) => r.type === 1 || r.type === 28);
  if (!records.length)
    throw new Error("The hostname has no public IP records.");
  if (records.some((r) => !publicAddress(r.data)))
    throw new Error(
      "The hostname resolves to a private network. Use a local collector.",
    );
  return url;
}
export async function runCloudProbe(
  check: Pick<
    Check,
    "kind" | "target" | "timeout" | "expectedStatus" | "expectedValue"
  >,
  fetcher: typeof fetch = fetch,
): Promise<Observation> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), check.timeout);
  try {
    if (check.kind === "dns") {
      if (!publicHostname(check.target))
        throw new Error("Use a public hostname for a cloud DNS check.");
      const result = await dnsQuery(
        check.target,
        "A",
        controller.signal,
        fetcher,
      );
      const records = (result.Answer || []).filter((a) => a.type === 1);
      if (result.Status !== 0 || !records.length)
        throw new Error("No DNS A records resolved.");
      if (
        check.expectedValue &&
        !records.some((r) => r.data === check.expectedValue)
      )
        throw new Error("DNS A records do not match the expected address.");
      return {
        status: "operational",
        latency: Date.now() - started,
        message: `Resolved ${records.length} A record${records.length === 1 ? "" : "s"}.`,
      };
    }
    if (check.kind !== "http")
      throw new Error("This check needs a local collector.");
    let next = check.target;
    for (let redirect = 0; redirect <= 2; redirect++) {
      const url = await safeHttpTarget(next, controller.signal, fetcher);
      const response = await fetcher(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "OpsGlass/1.0 (uptime monitor)" },
      });
      await response.body?.cancel();
      if (
        [301, 302, 303, 307, 308].includes(response.status) &&
        response.headers.get("location")
      ) {
        next = new URL(response.headers.get("location")!, url).href;
        continue;
      }
      return {
        status:
          response.status === check.expectedStatus
            ? "operational"
            : "major_outage",
        latency: Date.now() - started,
        message: `HTTP ${response.status}${response.status === check.expectedStatus ? "" : `; expected ${check.expectedStatus}`}.`,
      };
    }
    throw new Error("More than two redirects.");
  } catch (error) {
    return {
      status: "major_outage",
      latency: Date.now() - started,
      message: controller.signal.aborted
        ? `Timed out after ${check.timeout / 1000}s.`
        : error instanceof Error
          ? error.message.slice(0, 500)
          : "Check failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}
