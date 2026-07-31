export const QBO_SCOPE = "com.intuit.quickbooks.accounting";
export const QBO_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
export const QBO_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
export const QBO_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
export const QBO_MINOR_VERSION = "75";

export function qboApiBase() {
  const env = process.env.QBO_ENVIRONMENT === "production" ? "production" : "sandbox";
  return env === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

export function qboClientId() {
  const id = process.env.QBO_CLIENT_ID;
  if (!id) throw new Error("QBO_CLIENT_ID is not configured");
  return id;
}

export function qboClientSecret() {
  const secret = process.env.QBO_CLIENT_SECRET;
  if (!secret) throw new Error("QBO_CLIENT_SECRET is not configured");
  return secret;
}

export function qboRedirectUri() {
  const uri = process.env.QBO_REDIRECT_URI;
  if (!uri) throw new Error("QBO_REDIRECT_URI is not configured");
  return uri;
}

export function isQboConfigured() {
  return Boolean(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET && process.env.QBO_REDIRECT_URI);
}
