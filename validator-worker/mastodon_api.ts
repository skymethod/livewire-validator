// deno-lint-ignore-file camelcase

const APPLICATION_JSON_CHARSET_UTF8 = 'application/json; charset=utf-8';

// deno-lint-ignore no-explicit-any
function isObject(obj: any): boolean {
    return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
}

async function verifyJsonResponse<T>(res: Response, bodyVerifier: (body: any) => body is T): Promise<T> {
    if (res.status !== 200) throw new Error(`Unexpected http response status: ${res.status}, expected 200, body=${await res.text()}`);
    const contentType = res.headers.get('content-type');
    if (contentType !== APPLICATION_JSON_CHARSET_UTF8) throw new Error(`Unexpected http response status: ${contentType}, expected ${APPLICATION_JSON_CHARSET_UTF8}, body=${await res.text()}`);
    const body = await res.json();
    if (!bodyVerifier(body)) throw new Error(`Unexpected body: ${JSON.stringify(body, undefined, 2)}`);
    return body;
}

// https://docs.joinmastodon.org/methods/apps/oauth/#authorize-a-user

export interface OauthUserAuthorizationOpts {
    /** Should be set equal to `code`. */
    readonly response_type: string;

    /** Client ID, obtained during app registration. */
    readonly client_id: string;

    /** Set a URI to redirect the user to.
     * 
     * If this parameter is set to `urn:ietf:wg:oauth:2.0:oob` then the authorization code will be shown instead. Must match one of the redirect URIs declared during app registration. */
    readonly redirect_uri: string;

    /** List of requested OAuth scopes, separated by spaces.
     * 
     * Must be a subset of scopes declared during app registration. If not provided, defaults to `read`. */
    readonly scope?: string;

    /** Added in 2.6.0. Forces the user to re-login, which is necessary for authorizing with multiple accounts from the same instance. */
    readonly force_login?: boolean;
}

export function computeOauthUserAuthorizationUrl(apiBase: string, opts: OauthUserAuthorizationOpts): string {
    const { response_type, client_id, redirect_uri, scope, force_login } = opts;
    const url = new URL(`${apiBase}/oauth/authorize`);
    url.searchParams.set('response_type', response_type);
    url.searchParams.set('client_id', client_id);
    url.searchParams.set('redirect_uri', redirect_uri);
    if (scope) url.searchParams.set('scope', scope);
    if (typeof force_login === 'boolean') url.searchParams.set('force_login', `${force_login}`);
    return url.toString();
}

// https://docs.joinmastodon.org/methods/apps/oauth/#obtain-a-token

export interface OauthObtainTokenOpts {
    /** Set equal to `authorization_code` if `code` is provided in order to gain user-level access.
     * 
     * Otherwise, set equal to `client_credentials` to obtain app-level access only. */
    readonly grant_type: string;

    /** Client ID, obtained during app registration */
    readonly client_id: string;

    /** Client secret, obtained during app registration */
    readonly client_secret: string;

    /** Set a URI to redirect the user to.
     * 
     * If this parameter is set to `urn:ietf:wg:oauth:2.0:oob` then the token will be shown instead. Must match one of the redirect URIs declared during app registration. */
    readonly redirect_uri: string;

    /** List of requested OAuth scopes, separated by spaces. 
     * 
     * Must be a subset of scopes declared during app registration. If not provided, defaults to `read`. */
    readonly scope?: string;

    /** A user authorization code, obtained via /oauth/authorize */
    readonly code?: string;
}

export async function oauthObtainToken(apiBase: string, opts: OauthObtainTokenOpts): Promise<OauthObtainTokenResponse> {
    const { grant_type, client_id, client_secret, redirect_uri, scope, code } = opts;
    const data = new FormData();
    data.set('grant_type', grant_type);
    data.set('client_id', client_id);
    data.set('client_secret', client_secret);
    data.set('redirect_uri', redirect_uri);
    if (code) data.set('code', code);
    if (scope) data.set('scope', scope);
    const res = await fetch(`${apiBase}/oauth/token`, { method: 'POST', body: data });
    return verifyJsonResponse(res, isOauthObtainTokenResponse);
}

export interface OauthObtainTokenResponse {
    readonly access_token: string;
    readonly token_type: string; // e.g. Bearer
    readonly scope: string; // e.g. write:statuses read:accounts
    readonly created_at: number; // epoch seconds
}

// deno-lint-ignore no-explicit-any
function isOauthObtainTokenResponse(obj: any): obj is OauthObtainTokenResponse {
    return isObject(obj) 
        && typeof obj.access_token === 'string'
        && typeof obj.token_type === 'string'
        && typeof obj.scope === 'string'
        && typeof obj.created_at === 'number'
        ;
}

// https://docs.joinmastodon.org/methods/apps/

export interface AppsCreateApplicationOpts {
    /** A name for your application */
    readonly client_name: string;

    /** Where the user should be redirected after authorization. 
     * 
     * To display the authorization code to the user instead of redirecting to a web page, use `urn:ietf:wg:oauth:2.0:oob` in this parameter. */
    readonly redirect_uris: string;

    /** Space separated list of scopes.
     * 
     * If none is provided, defaults to `read`. */
    readonly scopes?: string;

    /** A URL to the homepage of your app */
    readonly website?: string;
}

export async function appsCreateApplication(apiBase: string, opts: AppsCreateApplicationOpts): Promise<AppsCreateApplicationResponse> {
    const { client_name, redirect_uris, scopes, website } = opts;
    const data = new FormData();
    data.set('client_name', client_name);
    data.set('redirect_uris', redirect_uris);
    if (scopes) data.set('scopes', scopes);
    if (website) data.set('website', website);
    const res = await fetch(`${apiBase}/api/v1/apps`, { method: 'POST', body: data });
    return verifyJsonResponse(res, isAppsCreateApplicationResponse);
}

export interface AppsCreateApplicationResponse {
    readonly id: string; // e.g. "123"
    readonly name: string;
    readonly website?: string;
    readonly redirect_uri: string;
    readonly client_id: string;
    readonly client_secret: string;
    readonly vapid_key: string;
}

// deno-lint-ignore no-explicit-any
function isAppsCreateApplicationResponse(obj: any): obj is AppsCreateApplicationResponse {
    return isObject(obj) 
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && (obj.website === undefined || typeof obj.website === 'string')
        && typeof obj.redirect_uri === 'string'
        && typeof obj.client_id === 'string'
        && typeof obj.client_secret === 'string'
        && typeof obj.vapid_key === 'string'
        ;
}

// https://docs.joinmastodon.org/methods/accounts/

/** Test to make sure that the user token works.
 * 
 * Returns: the user's own Account with Source
 */
export async function accountsVerifyCredentials(apiBase: string, accessToken: string): Promise<AccountsVerifyCredentialsResponse> {
    const res = await fetch(`${apiBase}/api/v1/accounts/verify_credentials`, { headers: { 'Authorization': `Bearer ${accessToken}`} });
    return verifyJsonResponse(res, isAccountsVerifyCredentialsResponse);
}

// deno-lint-ignore no-explicit-any
function isAccountsVerifyCredentialsResponse(obj: any): obj is AccountsVerifyCredentialsResponse {
    return isObject(obj) 
        && isSource(obj.source)
        && isAccount(obj);
}

export interface AccountsVerifyCredentialsResponse extends Account {
    source: Source;
}

// Api Entities

// https://docs.joinmastodon.org/entities/account/
export interface Account {
    readonly id: string; // e.g. "123"
    readonly username: string;
    readonly acct: string;
    readonly display_name: string;
    readonly locked: boolean;
    readonly bot: boolean;
    readonly discoverable: boolean;
    readonly group: boolean;
    readonly created_at: string;
    readonly note: string; // can contain markup
    readonly url: string; // <base>/@js
    readonly avatar: string;
    readonly avatar_static: string;
    readonly header: string;
    readonly header_static: string;
}

// deno-lint-ignore no-explicit-any
function isAccount(obj: any): obj is Account {
    return isObject(obj) 
        && typeof obj.id === 'string'
        && typeof obj.username === 'string'
        && typeof obj.display_name === 'string'
        && typeof obj.locked === 'boolean'
        && typeof obj.bot === 'boolean'
        && typeof obj.discoverable === 'boolean'
        && typeof obj.group === 'boolean'
        && typeof obj.created_at === 'string'
        && typeof obj.note === 'string'
        && typeof obj.url === 'string'
        && typeof obj.avatar === 'string'
        && typeof obj.avatar_static === 'string'
        && typeof obj.header === 'string'
        && typeof obj.header_static === 'string'
        ;
}


// https://docs.joinmastodon.org/entities/source/
export interface Source {
    readonly note: string; // no markup?
}

// deno-lint-ignore no-explicit-any
function isSource(obj: any): obj is Source {
    return isObject(obj)
        && typeof obj.note === 'string'
        ;
}

// https://docs.joinmastodon.org/entities/error/
export interface MastodonErrorResponse {
    readonly error: string;
    readonly error_description?: string;
}
