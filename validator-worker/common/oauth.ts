import { isObject } from './check.ts';

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
    readonly scope: string; // e.g. write:statuses read:accounts

    readonly created_at: number; // epoch seconds

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
    return isObject(obj) 
        && typeof obj.access_token === 'string'
        && typeof obj.token_type === 'string'
        && typeof obj.scope === 'string'
        && typeof obj.created_at === 'number'
        ;
}
