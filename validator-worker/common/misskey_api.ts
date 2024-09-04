import { isStringRecord } from './check.ts';
import { fetchJson } from './oauth.ts';


// https://thecle.land/api-doc#tag/users/POST/users/search
export async function usersSearch(apiBase: string, opts: UsersSearchOpts): Promise<UsersSearchResponse> {
    const { query, offset, limit, origin, detail } = opts;
    const body = JSON.stringify({
        query,
        offset,
        limit,
        origin,
        detail,
    });
    return await fetchJson(new Request(`${apiBase}/api/users/search`, { method: 'POST', body, headers: { 'content-type': 'application/json' } }), isUsersSearchResponse);
} 

export interface UsersSearchOpts {
    readonly query: string;
    readonly offset?: number;
    readonly limit?: number;
    readonly origin: string; // local, remote, or combined (default)
    readonly detail?: boolean; // default true
}

export type UsersSearchResponse = UsersSearchResponseItem[];

function isUsersSearchResponse(obj: unknown): obj is UsersSearchResponse {
    return Array.isArray(obj) && obj.every(isUsersSearchResponseItem);
}

export interface UsersSearchResponseItem {
    readonly id: string;
    readonly name: string;
    readonly username: string;
    readonly host: string;

}

function isUsersSearchResponseItem(obj: unknown): obj is UsersSearchResponseItem {
    return isStringRecord(obj) 
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && typeof obj.username === 'string'
        && typeof obj.host === 'string'
        ;
}

// https://thecle.land/api-doc#tag/federation/POST/ap/show
export async function apShow(apiBase: string, opts: ApShowOpts): Promise<ApShowResponse> {
    const { uri, accessToken } = opts;
    const body = JSON.stringify({
        uri,
    });
    return await fetchJson(new Request(`${apiBase}/api/ap/show`, { method: 'POST', body, headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` } }), isApShowResponse);
} 

export interface ApShowOpts {
    readonly uri: string;
    readonly accessToken: string;
}

export interface ApShowResponse {
    readonly type: string; // e.g. User
    readonly object: Record<string, unknown>;
}

function isApShowResponse(obj: unknown): obj is ApShowResponse {
    return isStringRecord(obj)
        && typeof obj.type === 'string'
        && isStringRecord(obj.object);
}


// https://thecle.land/api-doc#tag/following/POST/following/create
export async function followingCreate(apiBase: string, opts: FollowingCreateOpts): Promise<FollowingCreateResponse> {
    const { userId, accessToken } = opts;
    const body = JSON.stringify({
        userId,
    });
    return await fetchJson(new Request(`${apiBase}/api/following/create`, { method: 'POST', body, headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` } }), isFollowingCreateResponse);
} 

export interface FollowingCreateOpts {
    readonly userId: string;
    readonly accessToken: string;
}

export interface FollowingCreateResponse {
    readonly id: string;
    readonly name: string;
    readonly username: string;
    readonly host: string;
}

function isFollowingCreateResponse(obj: unknown): obj is FollowingCreateResponse {
    return isStringRecord(obj) 
        && typeof obj.id === 'string'
        && typeof obj.name === 'string'
        && typeof obj.username === 'string'
        && typeof obj.host === 'string'
        ;
}
