import "server-only";
import {
  QBO_AUTHORIZE_URL,
  QBO_SCOPE,
  QBO_TOKEN_URL,
  qboClientId,
  qboClientSecret,
  qboRedirectUri,
} from "./config";

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds, access token (~1hr)
  x_refresh_token_expires_in: number; // seconds, refresh token (~100 days)
  token_type: string;
};

function basicAuthHeader() {
  return "Basic " + Buffer.from(`${qboClientId()}:${qboClientSecret()}`).toString("base64");
}

/** Builds the Intuit consent screen URL. `state` should be an unguessable, verifiable nonce. */
export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: qboClientId(),
    redirect_uri: qboRedirectUri(),
    response_type: "code",
    scope: QBO_SCOPE,
    state,
  });
  return `${QBO_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: qboRedirectUri(),
    }),
  });
  if (!res.ok) {
    throw new Error(`QBO token exchange failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(QBO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`QBO token refresh failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}
