// deno-lint-ignore-file camelcase

import { isStringRecord } from './check.ts';
import { computeOauthUserAuthorizationUrl, fetchJson, oauthObtainToken, OauthObtainTokenOpts, OauthObtainTokenResponse, OauthUserAuthorizationOpts } from './oauth.ts';

// https://docs.joinmastodon.org/methods/apps/oauth/#authorize-a-user

export type MastodonOauthUserAuthorizationOpts = Omit<OauthUserAuthorizationOpts, 'authorization_endpoint'>;

export function computeMastodonOauthUserAuthorizationUrl(apiBase: string, opts: MastodonOauthUserAuthorizationOpts): string {
    return computeOauthUserAuthorizationUrl({ ...opts, authorization_endpoint: `${apiBase}/oauth/authorize` });
}

// https://docs.joinmastodon.org/methods/apps/oauth/#obtain-a-token

export type MastodonOauthObtainTokenOpts = Omit<OauthObtainTokenOpts, 'token_endpoint' | 'client_secret'> & { client_secret: string };

export async function mastodonOauthObtainToken(apiBase: string, opts: MastodonOauthObtainTokenOpts): Promise<OauthObtainTokenResponse> {
    return await oauthObtainToken({ ...opts, token_endpoint: `${apiBase}/oauth/token` });
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

export function eqAppsCreateApplicationOpts(lhs: AppsCreateApplicationOpts, rhs: AppsCreateApplicationOpts): boolean {
    return lhs.client_name === rhs.client_name
        && lhs.redirect_uris === rhs.redirect_uris
        && lhs.scopes === rhs.scopes
        && lhs.website === rhs.website
        ;
}

export async function appsCreateApplication(apiBase: string, opts: AppsCreateApplicationOpts): Promise<AppsCreateApplicationResponse> {
    const { client_name, redirect_uris, scopes, website } = opts;
    const data = new FormData();
    data.set('client_name', client_name);
    data.set('redirect_uris', redirect_uris);
    if (scopes) data.set('scopes', scopes);
    if (website) data.set('website', website);
    return await fetchJson(new Request(`${apiBase}/api/v1/apps`, { method: 'POST', body: data }), isAppsCreateApplicationResponse);
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

function isAppsCreateApplicationResponse(obj: unknown): obj is AppsCreateApplicationResponse {
    return isStringRecord(obj) 
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && (obj.website === undefined || obj.website === null || typeof obj.website === 'string')
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
    return await fetchJson(new Request(`${apiBase}/api/v1/accounts/verify_credentials`, { headers: { 'Authorization': `Bearer ${accessToken}`} }), isAccountsVerifyCredentialsResponse);
}

export interface AccountsVerifyCredentialsResponse extends Account {
    source: Source;
}

function isAccountsVerifyCredentialsResponse(obj: unknown): obj is AccountsVerifyCredentialsResponse {
    return isStringRecord(obj) 
        && isSource(obj.source)
        && isAccount(obj);
}

// https://docs.joinmastodon.org/methods/instance/

/** Information about the server. */
export async function instanceInformation(apiBase: string): Promise<Instance> {
    return await fetchJson(`${apiBase}/api/v1/instance`, isInstance);
}

// https://docs.joinmastodon.org/methods/statuses/

/** Publish a new status */
export interface StatusesPublishOpts {
    /** Prevent duplicate submissions of the same status. 
     * 
     * Idempotency keys are stored for up to 1 hour, and can be any arbitrary string. 
     * 
     * Consider using a hash or UUID generated client-side. */
    readonly idempotencyKey?: string;

    /** Text content of the status.
     * 
     * If media_ids is provided, this becomes optional. Attaching a poll is optional while status is provided. */
    readonly status: string;

    /** Include Attachment IDs to be attached as media. 
     * 
     * If provided, status becomes optional, and poll cannot be used. */
    readonly media_ids?: readonly string[];

    /** ID of the status being replied to, if status is a reply. */
    readonly in_reply_to_id?: string;

    /** Visibility of the posted status. */
    readonly visibility?: 'public' | 'unlisted' | 'private' | 'direct';
}

export async function statusesPublish(apiBase: string, accessToken: string, opts: StatusesPublishOpts): Promise<Status> {
    const { idempotencyKey, status, in_reply_to_id, visibility, media_ids } = opts;

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    const data = new FormData();
    data.set('status', status);
    if (in_reply_to_id) data.set('in_reply_to_id', in_reply_to_id);
    if (visibility) data.set('visibility', visibility);
    if (media_ids) media_ids.forEach(v => data.append('media_ids[]', v));
    
    return await fetchJson(new Request(`${apiBase}/api/v1/statuses`, { method: 'POST', body: data, headers }), isStatus);
}

export async function statusesViewById(apiBase: string, accessToken: string, id: string): Promise<Status> {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${accessToken}`);
    
    return await fetchJson(new Request(`${apiBase}/api/v1/statuses/${id}`, { headers }), isStatus);
}

// https://docs.joinmastodon.org/methods/media/#v2

/** Upload media as an attachment (async) */
export interface MediaUploadAsyncOpts {

    /** The file to be attached, encoded using multipart form data. The file must have a MIME type. */
    readonly file: Blob;

    /** A plain-text description of the media, for accessibility purposes. */
    readonly description?: string;
}

export async function mediaUploadAsync(apiBase: string, accessToken: string, opts: MediaUploadAsyncOpts): Promise<MediaAttachment> {
    const { file, description } = opts;

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${accessToken}`);
    const data = new FormData();
    data.set('file', file);
    if (typeof description === 'string' && description !== '') data.set('description', description);
    
    return await fetchJson(new Request(`${apiBase}/api/v2/media`, { method: 'POST', body: data, headers }), isMediaAttachment, { allow202: true });
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
    readonly discoverable?: boolean; // Pleroma: missing
    readonly group?: boolean; // Pleroma: missing
    readonly created_at: string;
    readonly note: string; // can contain markup
    readonly url: string; // <base>/@user
    readonly avatar: string;
    readonly avatar_static: string;
    readonly header: string;
    readonly header_static: string;
}

function isAccount(obj: unknown): obj is Account {
    return isStringRecord(obj) 
        && typeof obj.id === 'string'
        && typeof obj.username === 'string'
        && typeof obj.display_name === 'string'
        && typeof obj.locked === 'boolean'
        && typeof obj.bot === 'boolean'
        && (obj.discoverable === undefined || typeof obj.discoverable === 'boolean')
        && (obj.group === undefined || typeof obj.group === 'boolean')
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

function isSource(obj: unknown): obj is Source {
    return isStringRecord(obj)
        && typeof obj.note === 'string'
        ;
}

// https://docs.joinmastodon.org/entities/error/
export interface MastodonErrorResponse {
    readonly error: string;
    readonly error_description?: string;
}

// https://docs.joinmastodon.org/entities/instance/
export interface Instance {
    /** The domain name of the instance. */
    readonly uri: string;

    /** The title of the website. */
    readonly title: string;

    /** Admin-defined description of the Mastodon site. */
    readonly description: string;

    /** A shorter description defined by the admin. */
    readonly short_description: string;

    /** An email that may be contacted for any inquiries. 
     * 
     * Pleroma: optional
    */
    readonly email?: string;

    /** The version of Mastodon installed on the instance. */
    readonly version: string;

    // and others...
}

function isInstance(obj: unknown): obj is Instance {
    return isStringRecord(obj) 
        && typeof obj.uri === 'string'
        && typeof obj.title === 'string'
        && typeof obj.description === 'string'
        && (obj.short_description === undefined || typeof obj.short_description === 'string')
        && typeof obj.email === 'string'
        && typeof obj.version === 'string'
        ;
}

// https://docs.joinmastodon.org/entities/status/
export interface Status {
    /** ID of the status in the database. */
    readonly id: string;

    /** URI of the status used for federation. */
    readonly uri: string;

    /** The date when this status was created. */
    readonly created_at: string;

    // account: Account

    /** HTML-encoded status content. */
    readonly content: string;

    /** Visibility of this status.
     * 
     * public = Visible to everyone, shown in public timelines.
     * unlisted = Visible to public, but not included in public timelines.
     * private = Visible to followers only, and to any mentioned users.
     * direct = Visible only to mentioned users.
     */
    readonly visibility: string;

    // readonly application: Application;

    /** A link to the status's HTML representation. */
    readonly url?: string;

    /** A link to the status's HTML representation. */
    readonly in_reply_to_id?: string;
}

function isStatus(obj: unknown): obj is Status {
    return isStringRecord(obj) 
        && typeof obj.id === 'string'
        && typeof obj.uri === 'string'
        && typeof obj.created_at === 'string'
        && typeof obj.content === 'string'
        && typeof obj.visibility === 'string'
        && (obj.url === undefined || typeof obj.url === 'string')
        && (obj.in_reply_to_id === undefined || obj.in_reply_to_id === null || typeof obj.in_reply_to_id === 'string')
        ;
}

// https://docs.joinmastodon.org/entities/MediaAttachment/
export interface MediaAttachment {
    /** The ID of the attachment in the database. */
    readonly id: string;

    /** The type of the attachment. */
    readonly type: string;

    /** The location of a scaled-down preview of the attachment. */
    readonly preview_url: string;

    /** The location of the original full-size attachment. (Only missing when uploading async) */
    readonly url: string | null;

    // others

}

function isMediaAttachment(obj: unknown): obj is MediaAttachment {
    return isStringRecord(obj) 
        && typeof obj.id === 'string'
        && typeof obj.type === 'string'
        && typeof obj.preview_url === 'string'
        && (obj.url === null || typeof obj.url === 'string')
        ;
}
