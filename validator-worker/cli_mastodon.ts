import { accountsVerifyCredentials, appsCreateApplication, computeMastodonOauthUserAuthorizationUrl, instanceInformation, mediaUploadAsync, mastodonOauthObtainToken, statusesPublish, statusesViewById } from './common/mastodon_api.ts';
import { parseJsonc } from './deps_cli.ts';

export async function mastodon(args: (string | number)[]) {
    if (typeof args[0] !== 'string') throw new Error(`Pass the action as the first arg`);
    if (typeof args[1] !== 'string') throw new Error(`Pass the path to MastodonSecrets json as the second arg`);

    const action = args[0];
    
    const secrets = parseJsonc(await Deno.readTextFile(computeAbsolutePath(args[1]))) as MastodonSecrets;
    const { apiBase, clientName, redirectUris, redirectUri, scopes, website, clientId, clientSecret, accessToken, code, comment, status, statusId } = secrets;

    // read:accounts: for /api/v1/accounts/verify_credentials
    // write:statuses: for creating new comments

    if (action === 'instance-info') {
        const res = await instanceInformation(apiBase);
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'create-app') {
        const res = await appsCreateApplication(apiBase, { 
            client_name: clientName, 
            redirect_uris: redirectUris,
            scopes,
            website,
        });
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'oauth-authorize-url') {
        if (!clientId) throw new Error(`clientId is required`);

        const url = computeMastodonOauthUserAuthorizationUrl(apiBase, { 
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: scopes,
            force_login: true,
        });
        console.log(url);
    }

    if (action === 'oauth-obtain-token') {
        if (!clientId) throw new Error(`clientId is required`);
        if (!clientSecret) throw new Error(`clientSecret is required`);
        if (!code) throw new Error(`code is required`);

        const res = await mastodonOauthObtainToken(apiBase, {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
            scope: scopes,
        });
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'verify-credentials') {
        if (!accessToken) throw new Error(`accessToken is required`);

        const res = await accountsVerifyCredentials(apiBase, accessToken);
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'post-comment') {
        if (!accessToken) throw new Error(`accessToken is required`);
        if (!comment) throw new Error(`comment is required`);
        console.log(JSON.stringify(comment, undefined, 2));

        const account = await accountsVerifyCredentials(apiBase, accessToken);
        console.log('account url: ' + account.url);
        const res = await fetch(account.url, { headers: { 'Accept': 'application/activity+json'} });
        if (res.status !== 200) throw new Error(`${res.status} ${await res.text()}`);
        const person = await res.json() as ActivityPubPerson;
        // console.log(JSON.stringify(person, undefined, 2));
        console.log(`Outbox url: ${person.outbox}`);

        // https://www.w3.org/TR/activitypub/#client-to-server-interactions
        const res2 = await fetch(person.outbox, { 
            method: 'POST', 
            body: JSON.stringify(comment), 
            headers: { 'Content-Type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"', 'Authorization': `Bearer ${accessToken}`}, 
        });
        console.log(res2);
        console.log(await res2.text());
    }

    if (action === 'post-status') {
        if (!accessToken) throw new Error(`accessToken is required`);
        if (!status) throw new Error(`status is required`);
        const { idempotencyKey, content, inReplyToId, visibility: visibilityStr, mediaUrl } = status;
        const visibility = visibilityStr as 'public' | 'unlisted' | 'private' | 'direct' | undefined;
        console.log(JSON.stringify(status, undefined, 2));

        await accountsVerifyCredentials(apiBase, accessToken); // just checking

        let media_ids: string[] | undefined;
        if (mediaUrl) {
            const mediaResponse = await fetch(mediaUrl);
            if (mediaResponse.status !== 200) throw new Error();
            const file = await mediaResponse.blob();
            const res = await mediaUploadAsync(apiBase, accessToken, { file });
            console.log(JSON.stringify(res, undefined, 2));
            media_ids = [ res.id ];
        }

        const res = await statusesPublish(apiBase, accessToken, { status: content, idempotencyKey, in_reply_to_id: inReplyToId, visibility, media_ids });
        console.log(JSON.stringify(res, undefined, 2));
    }

    if (action === 'view-status') {
        if (!accessToken) throw new Error(`accessToken is required`);
        if (!statusId) throw new Error(`statusId is required`);

        await accountsVerifyCredentials(apiBase, accessToken); // just checking
        const res = await statusesViewById(apiBase, accessToken, statusId);
        console.log(JSON.stringify(res, undefined, 2));
    }
}

//

function computeAbsolutePath(path: string): string {
    if (path.startsWith('~/')) {
        const home = Deno.env.get('HOME');
        if (!home) throw new Error(`Expected $HOME`);
        return home + path.substring(1);
    }
    return path;
}

//

interface ActivityPubPerson {
    readonly outbox: string;
}

interface MastodonSecrets {
    readonly apiBase: string;
    readonly clientName: string;
    readonly redirectUris: string;
    readonly redirectUri: string;
    readonly scopes: string;
    readonly website?: string;
    readonly clientId?: string;
    readonly clientSecret?: string;
    readonly accessToken?: string;
    readonly code?: string;
    readonly comment?: Record<string, unknown>;
    readonly status?: MastodonStatus;
    readonly statusId?: string;
}

interface MastodonStatus {
    readonly idempotencyKey?: string;
    readonly content: string;
    readonly inReplyToId?: string;
    readonly visibility?: string;
    readonly mediaUrl?: string;
}
