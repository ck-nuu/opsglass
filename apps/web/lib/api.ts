export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      "The portal API could not be reached. Check that the Worker is running.",
    );
  }
  if (!response.ok)
    throw new ApiError(
      body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
        ? body.error
        : `The request failed (${response.status}).`,
      response.status,
    );
  return body as T;
}
export function download(name: string, body: unknown) {
  const url = URL.createObjectURL(
    new Blob(
      [typeof body === "string" ? body : JSON.stringify(body, null, 2)],
      { type: "application/json" },
    ),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export function relativeTime(value: string | null, now = Date.now()): string {
  if (!value) return "Never";
  const difference = now - Date.parse(value);
  if (!Number.isFinite(difference)) return "Unknown";
  if (difference < 60000) return "Just now";
  if (difference < 3600000) return `${Math.floor(difference / 60000)}m ago`;
  if (difference < 86400000) return `${Math.floor(difference / 3600000)}h ago`;
  return `${Math.floor(difference / 86400000)}d ago`;
}
