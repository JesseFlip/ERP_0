import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { exchangeCodeForTokens } from "@/lib/qbo/oauth";
import { pullCustomersFromQbo, pullItemsFromQbo } from "@/lib/qbo/sync";

const STATE_COOKIE = "qbo_oauth_state";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const settingsUrl = new URL("/settings", req.url);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!code || !state || !realmId || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("qbo_error", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  const orgId = expectedState.split(".")[0];

  try {
    const tokens = await exchangeCodeForTokens(code);
    const now = Date.now();

    await prisma.org.update({
      where: { id: orgId },
      data: {
        qboRealmId: realmId,
        qboAccessToken: encryptSecret(tokens.access_token),
        qboRefreshToken: encryptSecret(tokens.refresh_token),
        qboAccessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
        qboRefreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
        qboConnectedAt: new Date(),
        qboDisconnectedAt: null,
      },
    });

    // Pre-populate the catalog/customers from QBO so the composer isn't empty on day one.
    await Promise.allSettled([pullCustomersFromQbo(orgId), pullItemsFromQbo(orgId)]);

    settingsUrl.searchParams.set("qbo_connected", "1");
  } catch {
    settingsUrl.searchParams.set("qbo_error", "token_exchange_failed");
  }

  return NextResponse.redirect(settingsUrl);
}
