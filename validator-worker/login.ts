import { Bytes } from './deps_worker.ts';
import { appsCreateApplication, AppsCreateApplicationOpts, AppsCreateApplicationResponse, computeOauthUserAuthorizationUrl, eqAppsCreateApplicationOpts, instanceInformation, oauthObtainToken } from './mastodon_api.ts';
import { Storage } from './storage.ts';

export async function computeLogin(_request: Request, url: URL, storage: Storage, config: LoginConfig): Promise<Response> {
    
    try {
        console.log('login', url);
        const origin = url.searchParams.get('origin') || undefined;
        const code = url.searchParams.get('code') || undefined;
        const state = url.searchParams.get('state') || undefined;
        if (origin) {
            // determine origin ActivityPub server implementation, and forward to auth url
            const { applicationOpts } = config;

            const mastodonInstanceVersion = await tryFetchMastodonInstanceVersion(origin);
            if (mastodonInstanceVersion === undefined) throw new Error(`Unable to determine server for ${origin}`);
            // for now, treat mastodon and pleroma the same (pleroma instances will have "Pleroma" in the mastodonInstanceVersion)
    
            const { applicationResponse, nonce } = await registerClientAppIfNecessary(origin, applicationOpts, storage);
            const state = Bytes.ofUtf8(JSON.stringify({ origin, nonce } as OAuthState)).base64();
            const oauthLoginUrl = computeOauthUserAuthorizationUrl(origin, { 
                response_type: 'code',
                client_id: applicationResponse.client_id,
                redirect_uri: applicationResponse.redirect_uri,
                scope: applicationOpts.scopes,
                force_login: true,
                state
            });
    
            return new Response('', { status: 307, headers: { 'Location': oauthLoginUrl }});
        } else if (code && state) {
            const obj = JSON.parse(Bytes.ofBase64(state).utf8());
            if (!isOAuthState(obj)) throw new Error(`Invalid OAuthState`);
            const { origin, nonce } = obj;
            const info = await loadClientAppInfo(origin, storage);
            if (!info) throw new Error(`No info for ${origin}`);
            if (nonce !== info.nonce) throw new Error(`Invalid nonce`);
            
            const tokenResponse = await oauthObtainToken(origin, {
                grant_type: 'authorization_code',
                client_id: info.applicationResponse.client_id,
                client_secret: info.applicationResponse.client_secret,
                redirect_uri: info.applicationResponse.redirect_uri,
                code,
                scope: info.applicationOpts.scopes,
            });
            const html = `<html><head><script>window.opener.postMessage({"origin": "${origin}", "tokenResponse":${JSON.stringify(tokenResponse)}}, "${url.origin}");</script></head></html>`;
            return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html'} });
        }
        throw new Error('Invalid request');
    } catch (e) {
        return new Response(`${e}`, { status: 400 });
    }
}


export interface LoginConfig {
    applicationOpts: AppsCreateApplicationOpts;
}

//

async function tryFetchMastodonInstanceVersion(origin: string): Promise<string | undefined> {
    try {
        const { version } = await instanceInformation(origin);
        return version;
    } catch (e) {
        console.error('Error in tryFetchMastodonInstanceVersion', e);
        return undefined;
    }
}

async function loadClientAppInfo(origin: string, storage: Storage): Promise<ClientAppInfo | undefined> {
    const key = computeClientAppInfoKey(origin);
    const value = await storage.get(key);
    if (!value) return undefined;
    return JSON.parse(value) as ClientAppInfo;
}

async function saveClientAppInfo(origin: string, storage: Storage, info: ClientAppInfo) {
    const key = computeClientAppInfoKey(origin);
    await storage.set(key, JSON.stringify(info));
}

function computeClientAppInfoKey(origin: string): string {
    return `app:${origin}`;
}

async function registerClientAppIfNecessary(origin: string, applicationOpts: AppsCreateApplicationOpts, storage: Storage): Promise<ClientAppInfo> {
    const existing = await loadClientAppInfo(origin, storage);
    if (existing) {
        if (eqAppsCreateApplicationOpts(existing.applicationOpts, applicationOpts)) return existing;
    }

    console.log(`registerClientAppIfNecessary: creating new client at ${origin}...`);
    const applicationResponse = await appsCreateApplication(origin, applicationOpts);
    console.log(`registerClientAppIfNecessary: created new client at ${origin}`, JSON.stringify(applicationResponse, undefined, 2));
    const nonce = crypto.randomUUID().split('-').pop()!;
    const rt: ClientAppInfo = { applicationOpts, applicationResponse, nonce, origin };
    saveClientAppInfo(origin, storage, rt);
    return rt;
}

//

interface ClientAppInfo {
    origin: string,
    applicationOpts: AppsCreateApplicationOpts,
    applicationResponse: AppsCreateApplicationResponse,
    nonce: string;
}

interface OAuthState {
    readonly nonce: string,
    readonly origin: string,
}

// deno-lint-ignore no-explicit-any
function isOAuthState(obj: any): obj is OAuthState {
    return typeof obj === 'object' && !Array.isArray(obj) && obj !== null
        && typeof obj.nonce === 'string'
        && typeof obj.origin === 'string'
        ;
}
