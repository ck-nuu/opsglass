import type { CredentialKind, CredentialSummary } from "@repo/registry";
import type { Env } from "./env";
import { HttpError } from "./env";

export async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function secretMatches(a: string, b: string) {
  return Boolean(a && b) && (await digest(a)) === (await digest(b));
}

export type CredentialSecret =
  | { kind: "basic"; username: string; password: string }
  | { kind: "bearer"; token: string }
  | {
      kind: "cloudflare_access";
      clientId: string;
      clientSecret: string;
    };

export type CredentialRow = {
  id: string;
  name: string;
  kind: CredentialKind;
  ciphertext: string;
  iv: string;
  created_at: string;
  updated_at: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function unbase64(value: string): Uint8Array {
  try {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(503, "The monitoring credential vault is unavailable.");
  }
}

async function vaultKey(env: Env): Promise<CryptoKey> {
  if (!env.CREDENTIAL_ENCRYPTION_KEY)
    throw new HttpError(
      503,
      "The monitoring credential vault has not been configured.",
    );
  const material = unbase64(env.CREDENTIAL_ENCRYPTION_KEY);
  if (material.byteLength !== 32)
    throw new HttpError(503, "The monitoring credential vault is unavailable.");
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function additionalData(id: string, kind: CredentialKind) {
  return encoder.encode(`opsglass:${id}:${kind}:v1`);
}

export async function encryptCredential(
  env: Env,
  id: string,
  secret: CredentialSecret,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: additionalData(id, secret.kind),
      tagLength: 128,
    },
    await vaultKey(env),
    encoder.encode(JSON.stringify(secret)),
  );
  return { ciphertext: base64(new Uint8Array(ciphertext)), iv: base64(iv) };
}

export async function decryptCredential(
  env: Env,
  row: CredentialRow,
): Promise<CredentialSecret> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: unbase64(row.iv),
        additionalData: additionalData(row.id, row.kind),
        tagLength: 128,
      },
      await vaultKey(env),
      unbase64(row.ciphertext),
    );
    const value = JSON.parse(decoder.decode(plaintext)) as CredentialSecret;
    if (value.kind !== row.kind) throw new Error("Credential type mismatch.");
    return value;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      503,
      "The monitoring credential could not be decrypted.",
    );
  }
}

export function credentialSummary(row: CredentialRow): CredentialSummary {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function utf8Base64(value: string) {
  return base64(encoder.encode(value));
}

export async function monitoringHeaders(
  env: Env,
  credentialId: string,
): Promise<Record<string, string>> {
  if (!credentialId) return {};
  const row = await env.DB.prepare(
    "SELECT * FROM monitoring_credentials WHERE id = ?",
  )
    .bind(credentialId)
    .first<CredentialRow>();
  if (!row)
    throw new HttpError(409, "The monitoring credential no longer exists.");
  const secret = await decryptCredential(env, row);
  if (secret.kind === "basic")
    return {
      Authorization: `Basic ${utf8Base64(`${secret.username}:${secret.password}`)}`,
    };
  if (secret.kind === "bearer")
    return { Authorization: `Bearer ${secret.token}` };
  return {
    "CF-Access-Client-Id": secret.clientId,
    "CF-Access-Client-Secret": secret.clientSecret,
  };
}
