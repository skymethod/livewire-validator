import { checkMatchesReturnMatcher } from './common/check.ts';
import { Bytes } from './deps_worker.ts';
import { appsCreateApplication, AppsCreateApplicationOpts, AppsCreateApplicationResponse, computeOauthUserAuthorizationUrl, eqAppsCreateApplicationOpts, instanceInformation, oauthObtainToken } from './mastodon_api.ts';
import { Storage } from './storage.ts';

export async function computeLogin(_request: Request, url: URL, storage: Storage, config: LoginConfig): Promise<Response> {
    try {
        console.log('login', url);

        // start auth code flow
        const origin = url.searchParams.get('origin') || undefined;
        if (origin) {
            // determine origin ActivityPub server implementation, and forward to auth url
            const { applicationOpts } = config;

            const mastodonInstanceVersion = await tryFetchMastodonInstanceVersion(origin);
            if (mastodonInstanceVersion === undefined) throw new Error(`Unable to determine server for ${origin}`);
            // for now, treat mastodon and pleroma the same (pleroma instances will have "Pleroma" in the mastodonInstanceVersion)
    
            // ensure we have a registered oauth client app for this origin, use an existing one if possible to avoid creating duplicate garbage on the mastodon instance
            const { applicationResponse } = await registerClientAppIfNecessary(origin, applicationOpts, storage);

            // start auth code flow, try to use PKCE
            const oauthRequestId: OauthRequestId = { time: Date.now(), nonce: crypto.randomUUID().toLowerCase().split('-').pop()! };
            const codeVerifier = computeOauthPkceCodeVerifier();
            const codeChallenge = encodeTrimmedUrlsafeBase64(await Bytes.ofUtf8(codeVerifier).sha256());
            await saveOauthRequestInfo(storage, { id: oauthRequestId, origin, codeVerifier });
            const state = packOauthRequestId(oauthRequestId);
            const oauthLoginUrl = computeOauthUserAuthorizationUrl(origin, { 
                response_type: 'code',
                client_id: applicationResponse.client_id,
                redirect_uri: applicationResponse.redirect_uri,
                scope: applicationOpts.scopes,
                force_login: true,
                state,
                code_challenge_method: 'S256',
                code_challenge: codeChallenge,
            });
    
            return new Response('', { status: 307, headers: { 'Location': oauthLoginUrl }});
        } 
        
        // callback from auth code flow
        const code = url.searchParams.get('code') || undefined;
        const state = url.searchParams.get('state') || undefined;
        if (code && state) {
            const oauthRequestId = unpackOauthRequestId('state', state);
            const oauthRequestInfo = await loadOauthRequestInfo(oauthRequestId, storage);
            if (!oauthRequestInfo) throw new Error('Bad state');

            const { origin, codeVerifier } = oauthRequestInfo;
            const info = await loadClientAppInfo(origin, storage);
            if (!info) throw new Error(`No info for ${origin}`);
            
            await deleteOauthRequestInfo(oauthRequestId, storage);

            const tokenResponse = await oauthObtainToken(origin, {
                grant_type: 'authorization_code',
                client_id: info.applicationResponse.client_id,
                client_secret: info.applicationResponse.client_secret,
                redirect_uri: info.applicationResponse.redirect_uri,
                code,
                scope: info.applicationOpts.scopes,
                // code_verifier: codeVerifier + 'bad',
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

export function computeOauthPkceCodeVerifier() {
    // https://www.oauth.com/oauth2-servers/pkce/authorization-request/
    // Cryptographically random string using the characters A-Z, a-z, 0-9, and the punctuation characters -._~ (hyphen, period, underscore, and tilde), between 43 and 128 characters long.
    const bytes = new Bytes(crypto.getRandomValues(new Uint8Array(50)));
    return encodeTrimmedUrlsafeBase64(bytes);
}

//

function encodeTrimmedUrlsafeBase64(bytes: Bytes) {
    return bytes.base64()
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

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

async function saveOauthRequestInfo(storage: Storage, info: OauthRequestInfo) {
    const key = computeOauthRequestInfoKey(info.id);
    await storage.set(key, JSON.stringify(info));
}

async function loadOauthRequestInfo(id: OauthRequestId, storage: Storage): Promise<OauthRequestInfo | undefined> {
    const key = computeOauthRequestInfoKey(id);
    const value = await storage.get(key);
    if (!value) return undefined;
    return JSON.parse(value) as OauthRequestInfo;
}

async function deleteOauthRequestInfo(id: OauthRequestId, storage: Storage) {
    const key = computeOauthRequestInfoKey(id);
    await storage.delete(key);
}

function computeOauthRequestInfoKey(id: OauthRequestId): string {
    return `oauthreq:${packOauthRequestId(id)}`;
}

async function registerClientAppIfNecessary(origin: string, applicationOpts: AppsCreateApplicationOpts, storage: Storage): Promise<ClientAppInfo> {
    const existing = await loadClientAppInfo(origin, storage);
    if (existing) {
        if (eqAppsCreateApplicationOpts(existing.applicationOpts, applicationOpts)) return existing;
    }

    console.log(`registerClientAppIfNecessary: creating new client at ${origin}...`);
    const applicationResponse = await appsCreateApplication(origin, applicationOpts);
    console.log(`registerClientAppIfNecessary: created new client at ${origin}`, JSON.stringify(applicationResponse, undefined, 2));
    const rt: ClientAppInfo = { applicationOpts, applicationResponse, origin };
    saveClientAppInfo(origin, storage, rt);
    return rt;
}

function packOauthRequestId(id: OauthRequestId): string {
    return [id.time, id.nonce].join(':');
}

function unpackOauthRequestId(name: string, str: string): OauthRequestId {
    const m = checkMatchesReturnMatcher(name, str, /^(\d{13}):([0-9a-f]{12})$/);
    return { time: parseInt(m[1]), nonce: m[2] };
}

//

interface ClientAppInfo {
    origin: string,
    applicationOpts: AppsCreateApplicationOpts,
    applicationResponse: AppsCreateApplicationResponse,
}

interface OauthRequestId {
    readonly time: number;
    readonly nonce: string;
}

interface OauthRequestInfo {
    readonly id: OauthRequestId;
    readonly origin: string;
    readonly codeVerifier: string;
}
