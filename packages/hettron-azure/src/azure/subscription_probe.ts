import { join } from "@std/path";
import z from "zod";
import { err, ok, type Result } from "../lib/result.ts";
import { azureCliConfigDir } from "./stdio.ts";

// Azure CLI can fail login after caching an ARM token, and its error output
// does not reliably distinguish "no subscription" from other login failures.

const MANAGEMENT_AUDIENCES = new Set([
  "https://management.azure.com/",
  "https://management.core.windows.net/",
]);

const TENANTS_URL =
  "https://management.azure.com/tenants?api-version=2022-12-01";
const SUBSCRIPTIONS_URL =
  "https://management.azure.com/subscriptions?api-version=2022-12-01";

const TokenCache = z.object({
  AccessToken: z.record(z.string(), z.unknown()).default({}),
}).loose();
const AccessTokenEntry = z.object({
  secret: z.string(),
}).loose();
const JwtPayload = z.object({
  aud: z.string(),
  exp: z.number(),
}).loose();
const ArmListResponse = z.object({
  value: z.array(z.unknown()),
}).loose();

export type AzureSubscriptionProbeValue = {
  tenantCount: number;
  subscriptionCount: number;
};

export type AzureSubscriptionProbeFailure = {
  type:
    | "missing-cache"
    | "missing-token"
    | "invalid-cache"
    | "tenant-request-failed"
    | "subscription-request-failed"
    | "malformed-response";
  message: string;
};

export type AzureSubscriptionProbeResult = Result<
  AzureSubscriptionProbeValue,
  AzureSubscriptionProbeFailure
>;

type ArmFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type CacheProbeOptions = {
  fetch?: ArmFetch;
  nowSeconds?: number;
};

export async function probeCachedAzureSubscriptions(
  options: CacheProbeOptions = {},
): Promise<AzureSubscriptionProbeResult> {
  const cachePath = join(azureCliConfigDir(), "msal_token_cache.json");
  const cache = await readTokenCache(cachePath);
  if (!cache.ok) {
    return cache;
  }

  const token = selectAzureManagementAccessToken(
    cache.value,
    options.nowSeconds ?? Date.now() / 1000,
  );
  if (!token) {
    return err({
      type: "missing-token",
      message: "No usable Azure management token was found in the CLI cache.",
    });
  }

  const armFetch = options.fetch ?? fetch;
  const tenants = await armGet(armFetch, token, TENANTS_URL, "tenant");
  if (!tenants.ok) {
    return tenants;
  }
  const subscriptions = await armGet(
    armFetch,
    token,
    SUBSCRIPTIONS_URL,
    "subscription",
  );
  if (!subscriptions.ok) {
    return subscriptions;
  }

  const tenantResponse = ArmListResponse.safeParse(tenants.value);
  if (!tenantResponse.success) {
    return err({
      type: "malformed-response",
      message:
        "Azure management tenant response did not include a value array.",
    });
  }
  const subscriptionResponse = ArmListResponse.safeParse(subscriptions.value);
  if (!subscriptionResponse.success) {
    return err({
      type: "malformed-response",
      message:
        "Azure management subscription response did not include a value array.",
    });
  }

  return ok({
    tenantCount: tenantResponse.data.value.length,
    subscriptionCount: subscriptionResponse.data.value.length,
  });
}

export function selectAzureManagementAccessToken(
  cache: unknown,
  nowSeconds: number,
): string | undefined {
  const parsedCache = TokenCache.safeParse(cache);
  if (!parsedCache.success) {
    return undefined;
  }

  const tokens = Object.values(parsedCache.data.AccessToken).flatMap(
    (entry) => {
      const parsedEntry = AccessTokenEntry.safeParse(entry);
      if (!parsedEntry.success) {
        return [];
      }
      const payload = JwtPayload.safeParse(
        decodeJwtPayload(parsedEntry.data.secret),
      );
      if (!payload.success) {
        return [];
      }
      if (
        !MANAGEMENT_AUDIENCES.has(payload.data.aud)
      ) {
        return [];
      }
      if (payload.data.exp <= nowSeconds) {
        return [];
      }
      return [{ token: parsedEntry.data.secret, exp: payload.data.exp }];
    },
  );

  return tokens.sort((left, right) => left.exp - right.exp).at(-1)?.token;
}

async function readTokenCache(
  cachePath: string,
): Promise<Result<unknown, AzureSubscriptionProbeFailure>> {
  let text: string;
  try {
    text = await Deno.readTextFile(cachePath);
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return err({
        type: "missing-cache",
        message: "Azure CLI token cache was not found.",
      });
    }
    throw error;
  }

  if (!text.trim()) {
    return err({
      type: "missing-cache",
      message: "Azure CLI token cache was empty.",
    });
  }

  try {
    return ok(JSON.parse(text));
  } catch (error) {
    return err({
      type: "invalid-cache",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function armGet(
  armFetch: ArmFetch,
  token: string,
  url: string,
  label: "tenant" | "subscription",
): Promise<Result<unknown, AzureSubscriptionProbeFailure>> {
  let response: Response;
  try {
    response = await armFetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    return err({
      type: label === "tenant"
        ? "tenant-request-failed"
        : "subscription-request-failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!response.ok) {
    return err({
      type: label === "tenant"
        ? "tenant-request-failed"
        : "subscription-request-failed",
      message:
        `Azure management ${label} request failed with HTTP ${response.status}.`,
    });
  }

  try {
    return ok(await response.json());
  } catch (error) {
    return err({
      type: "malformed-response",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function decodeJwtPayload(token: string): unknown {
  const payload = token.split(".")[1];
  if (!payload) {
    return undefined;
  }
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const decoded = new TextDecoder().decode(base64ToBytes(padded));
    return JSON.parse(decoded);
  } catch {
    return undefined;
  }
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
