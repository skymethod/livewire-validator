import { isOptionalString, isOptionalStringArray, isOptionalNumber, isStringRecord } from './check.ts';

// OAuth 2.0 Authorization Server Metadata
// https://datatracker.ietf.org/doc/html/rfc8414#section-3

export async function oauthAuthorizationServerMetadata({ hostname, fetcher = fetch }: { hostname: string, fetcher?: typeof fetch }): Promise<AuthorizationServerMetadata> {
    return await fetchJson(`https://${hostname}/.well-known/oauth-authorization-server`, isAuthorizationServerMetadata, { fetcher });
}

// https://datatracker.ietf.org/doc/html/rfc8414#section-2
export interface AuthorizationServerMetadata { 
    /** URL of the authorization server's authorization endpoint [RFC6749].
     * 
     * This is REQUIRED unless no grant types are supported that use the authorization endpoint. */
    readonly authorization_endpoint: string;

    /** URL of the authorization server's token endpoint [RFC6749].
     * 
     * This is REQUIRED unless only the implicit grant type is supported. */
    readonly token_endpoint: string;

    /** (mastodon, non-standard)
     * 
     * e.g. https://mastodon.example/api/v1/apps */
    readonly app_registration_endpoint?: string;

    /** OPTIONAL. JSON array containing a list of Proof Key for Code Exchange (PKCE) [RFC7636] code challenge methods supported by this authorization server.
     * 
     * Code challenge method values are used in the "code_challenge_method" parameter defined in Section 4.3 of [RFC7636].
     * 
     * The valid code challenge method values are those registered in the IANA "PKCE Code Challenge Methods" registry [IANA.OAuth.Parameters].  If omitted, the authorization server does not support PKCE.
     * 
     * e.g. 'S256' */
    readonly code_challenge_methods_supported?: readonly string[];

    /** OPTIONAL. JSON array containing a list of the OAuth 2.0 grant type values that this authorization server supports.
     * 
     * The array values used are the same as those used with the "grant_types" parameter defined by "OAuth 2.0 Dynamic Client Registration Protocol" [RFC7591].
     * 
     * If omitted, the default value is "["authorization_code", "implicit"]".
     * 
     * e.g. authorization_code, password, client_credentials
     */
    readonly grant_types_supported?: readonly string[];

    /** REQUIRED. The authorization server's issuer identifier, which is a URL that uses the "https" scheme and has no query or fragment components.
     * 
     * Authorization server metadata is published at a location that is ".well-known" according to RFC 5785 [RFC5785] derived from this issuer identifier, as described in Section 3.
     * 
     *  The issuer identifier is used to prevent authorization server mix-up attacks, as described in "OAuth 2.0 Mix-Up Mitigation" [MIX-UP].
     * 
     * e.g. https://mastodon.example/
     * */
    readonly issuer?: string;

    /** OPTIONAL. JSON array containing a list of the OAuth 2.0 "response_mode" values that this authorization server supports, as specified in "OAuth 2.0 Multiple Response Type Encoding Practices" [OAuth.Responses].
     * 
     * If omitted, the default is "["query", "fragment"]".  The response mode value "form_post" is also defined in "OAuth 2.0 Form Post Response Mode" [OAuth.Post].
     * 
     * e.g. query, fragment, form_post
     * */
    readonly response_modes_supported?: readonly string[];

    /** REQUIRED. JSON array containing a list of the OAuth 2.0 "response_type" values that this authorization server supports.
     * 
     * The array values used are the same as those used with the "response_types" parameter defined by "OAuth 2.0 Dynamic Client Registration Protocol" [RFC7591].
     * 
     * e.g. code
     * */
    readonly response_types_supported?: readonly string[];

    /** OPTIONAL. URL of the authorization server's OAuth 2.0 revocation endpoint [RFC7009].
     * 
     * e.g. https://mastodon.example/oauth/revoke
     */
    readonly revocation_endpoint?: string;

    /** RECOMMENDED. JSON array containing a list of the OAuth 2.0 [RFC6749] "scope" values that this authorization server supports.
     * 
     * Servers MAY choose not to advertise some supported scope values even when this parameter is used.
     * 
     * e.g. read, profile, write, write:accounts, ...
     *  */
    readonly scopes_supported?: string[];

    /** OPTIONAL. URL of a page containing human-readable information that developers might want or need to know when using the authorization server.
     * 
     * In particular, if the authorization serverdoes not support Dynamic Client Registration, then information on how to register clients needs to be provided in this documentation.
     * 
     * e.g. https://docs.joinmastodon.org/
     * */
    readonly service_documentation?: string;

    /** OPTIONAL. JSON array containing a list of client authentication methods supported by this token endpoint. 
     * 
     * Client authentication method values are used in the "token_endpoint_auth_method" parameter defined in Section 2 of [RFC7591].
     * 
     * If omitted, the default is "client_secret_basic" -- the HTTP Basic Authentication Scheme specified in Section 2.3.1 of OAuth 2.0 [RFC6749].
     * 
     * e.g. client_secret_basic, client_secret_post
     * */
    readonly token_endpoint_auth_methods_supported?: readonly string[];
};

export function isAuthorizationServerMetadata(obj: unknown): obj is AuthorizationServerMetadata {
    return isStringRecord(obj)
        && typeof obj.authorization_endpoint === 'string'
        && typeof obj.token_endpoint === 'string'
        && isOptionalString(obj.app_registration_endpoint)
        && isOptionalStringArray(obj.code_challenge_methods_supported)
        && isOptionalStringArray(obj.grant_types_supported)
        && isOptionalString(obj.issuer)
        && isOptionalStringArray(obj.response_modes_supported)
        && isOptionalStringArray(obj.response_types_supported)
        && isOptionalString(obj.revocation_endpoint)
        && isOptionalStringArray(obj.scopes_supported)
        && isOptionalString(obj.service_documentation)
        && isOptionalStringArray(obj.token_endpoint_auth_methods_supported)
        ;
}

// OAuth 2.0 Compute authorization url

export const OOB_REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

export interface OauthUserAuthorizationOpts {

    readonly authorization_endpoint: string;

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

    // standard oauth
    readonly state?: string;

    // oauth PKCE: base64url(SHA256(code verifier))
    readonly code_challenge?: string;

    // oauth PKCE: whether the challenge is the plain code verifier string or the SHA256 hash of the string.
    readonly code_challenge_method?: 'S256' | 'plain';
}

export function computeOauthUserAuthorizationUrl(opts: OauthUserAuthorizationOpts): string {
    const { response_type, client_id, redirect_uri, scope, force_login, state, code_challenge, code_challenge_method, authorization_endpoint } = opts;
    const url = new URL(authorization_endpoint);
    url.searchParams.set('response_type', response_type);
    url.searchParams.set('client_id', client_id);
    url.searchParams.set('redirect_uri', redirect_uri);
    if (scope) url.searchParams.set('scope', scope);
    if (typeof force_login === 'boolean') url.searchParams.set('force_login', `${force_login}`);
    if (state) url.searchParams.set('state', state);
    if (code_challenge) url.searchParams.set('code_challenge', code_challenge);
    if (code_challenge_method) url.searchParams.set('code_challenge_method', code_challenge_method);
    return url.toString();
}

// OAuth 2.0 Obtain token

export interface OauthObtainTokenOpts {

    readonly token_endpoint: string;

    /** Set equal to `authorization_code` if `code` is provided in order to gain user-level access.
     * 
     * Otherwise, set equal to `client_credentials` to obtain app-level access only. */
    readonly grant_type: string;

    /** Client ID, obtained during app registration */
    readonly client_id: string;

    /** Client secret, obtained during app registration */
    readonly client_secret?: string;

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

    /** Oauth PKCE: The code verifier for the request, that the app originally generated before the authorization request. */
    readonly code_verifier?: string;

    readonly useFormData?: boolean; // default json

    readonly fetcher?: typeof fetch;
}

export async function oauthObtainToken(opts: OauthObtainTokenOpts): Promise<OauthObtainTokenResponse> {
    const { grant_type, client_id, client_secret, redirect_uri, scope, code, code_verifier, token_endpoint, fetcher, useFormData } = opts;
    const data = new Map<string, string>();
    data.set('grant_type', grant_type);
    data.set('client_id', client_id);
    if (client_secret) data.set('client_secret', client_secret);
    data.set('redirect_uri', redirect_uri);
    if (code) data.set('code', code);
    if (scope) data.set('scope', scope);
    if (code_verifier) data.set('code_verifier', code_verifier);

    const body = useFormData ? (() => {
        const rt = new URLSearchParams();
        data.forEach((v, k) => rt.append(k, v));
        return rt.toString();
    })() : JSON.stringify(Object.fromEntries([...data]));
    return await fetchJson(new Request(token_endpoint, { method: 'POST', headers: { 'content-type': useFormData ? 'application/x-www-form-urlencoded' : 'application/json' }, body }), isOauthObtainTokenResponse, { fetcher });
}


// https://datatracker.ietf.org/doc/html/rfc6749#section-4.2.2
export interface OauthObtainTokenResponse {

    /** REQUIRED.  The access token issued by the authorization server. */
    readonly access_token: string;

    /** REQUIRED.  The type of the token issued as described in Section 7.1.  
     * 
     * Value is case insensitive. */
    readonly token_type: string; // e.g. Bearer

    /** OPTIONAL, if identical to the scope requested by the client; otherwise, REQUIRED.  
     * The scope of the access token as described by Section 3.3. */
    readonly scope?: string; // e.g. write:statuses read:accounts

    // additional fields found only in Mastodon
    readonly created_at?: number; // epoch seconds

    // additional fields found only in Pleroma:

    /** RECOMMENDED.  The lifetime in seconds of the access token.
     * 
     * For example, the value "3600" denotes that the access token will 
     * expire in one hour from the time the response was generated. 
     * 
     * If omitted, the authorization server SHOULD provide the 
     * expiration time via other means or document the default value. */
    readonly expires_in?: number; 

    readonly id?: number; // user id?

    readonly me?: string; // user profile url

    /** OPTIONAL.  The refresh token, which can be used to obtain new access tokens using the same authorization grant as described in Section 6. */
    readonly refresh_token?: string;
}

// deno-lint-ignore no-explicit-any
export function isOauthObtainTokenResponse(obj: any): obj is OauthObtainTokenResponse {
    return isStringRecord(obj) 
        && typeof obj.access_token === 'string'
        && typeof obj.token_type === 'string'
        && typeof obj.scope === 'string'
        && isOptionalNumber(obj.created_at)
        ;
}

// OAuth 2.0 Revoke token

export interface OauthRevokeTokenOpts {
    readonly revocation_endpoint: string;
    readonly client_id: string;
    readonly client_secret?: string;
    readonly token: string;
}

export async function oauthRevokeToken(opts: OauthRevokeTokenOpts): Promise<void> {
    const { revocation_endpoint, client_id, client_secret, token } = opts;
    const data = new Map<string, string>();
    data.set('client_id', client_id);
    data.set('token', token);
    if (client_secret) data.set('client_secret', client_secret);
    const body = JSON.stringify(Object.fromEntries([...data]));
    await fetchJson(new Request(revocation_endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body }), isStringRecord);
}

//

export async function fetchJson<T>(req: string | Request, bodyVerifier: (body: unknown) => body is T, { allow202, fetcher = fetch }: { fetcher?: typeof fetch, allow202?: boolean } = {}): Promise<T> {
    const res = await fetcher(req);
    if (!(res.status === 200 || allow202 && res.status === 202)) throw new Error(`Unexpected response status: ${res.status}, expected 200${allow202 ? ' or 202' : ''}, body=${await res.text()}`);
    const contentType = res.headers.get('content-type') ?? undefined;
    if (!/json/i.test(contentType ?? '')) throw new Error(`Unexpected response content-type: ${contentType}, expected json, body=${await res.text()}`);
    const body = await res.json();
    if (!bodyVerifier(body)) throw new Error(`Unexpected body: ${JSON.stringify(body, undefined, 2)}`);
    return body;
}
