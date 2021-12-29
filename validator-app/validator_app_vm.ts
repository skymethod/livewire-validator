import { ValidationJobVM, ValidationJobVMOpts, Message, ExtendedXmlNode, FetchCommentsResult, PIFeedInfo, ValidationOptions, OauthObtainTokenResponse, isObject, isOauthObtainTokenResponse, checkEqual, checkTrue, statusesPublish  } from './deps_app.ts';

export class ValidatorAppVM {

    private readonly job: ValidationJobVM;
    
    //

    get validating(): boolean { return this.job.validating; }

    get messages(): readonly Message[] { return this.job.messages; }

    get isSearch(): boolean { return this.job.isSearch; }

    get searchResults(): readonly PIFeedInfo[] { return this.job.searchResults; }

    get xml(): ExtendedXmlNode | undefined { return this.job.xml; }

    get xmlSummaryText(): string | undefined { return this.job.xmlSummaryText; }

    get fetchCommentsResult(): FetchCommentsResult | undefined { return this.job.fetchCommentsResult; }

    constructor(opts: ValidationJobVMOpts) {
        this.job = new ValidationJobVM(opts);
        this.job.onChange = () => this.onChange();
    }

    onChange: () => void = () => {};

    start() {
        // load initial state, etc. noop for now
    }

    continueWith(url: string) {
        this.job.continueWith(url);
    }

    startValidation(input: string, options: ValidationOptions) {
        this.job.startValidation(input, options);
    }

    cancelValidation() {
        this.job.cancelValidation();
    }

    isLoggedIn(origin: string): boolean {
        const info = loadLoginInfo(origin);
        return info !== undefined && !computeExpired(info.tokenResponse);
    }

    acceptLogin(origin: string, tokenResponse: OauthObtainTokenResponse) {
        checkEqual('token_type', tokenResponse.token_type.toLowerCase(), 'bearer');
        checkTrue('created_at, expires_in', [tokenResponse.created_at, tokenResponse.expires_in].join(', '), !computeExpired(tokenResponse));
        saveLoginInfo({ origin, tokenResponse });
    }

    expireLogin(origin: string) {
        deleteLoginInfo(origin);
    }

    async sendReply(reply: string, replyToUrl: string): Promise<string | undefined> {
        reply = reply.trim();
        if (reply === '') throw new Error('Bad reply: <empty>');
        const { origin } = new URL(replyToUrl);
        const info = loadLoginInfo(origin);
        if (!info) throw new Error(`No login for ${origin}`);
        if (computeExpired(info.tokenResponse)) throw new Error(`Login expired for ${origin}`);
        console.log(`replyToUrl`, replyToUrl);
        const mastodonId = computeMastodonIdForUrl(replyToUrl);
        console.log(`mastodonId`, mastodonId);
        const { url } = await statusesPublish(origin, info.tokenResponse.access_token, { status: reply, in_reply_to_id: mastodonId });
        return url;
    }

}

//

function computeExpired(tokenResponse: OauthObtainTokenResponse): boolean {
    return typeof tokenResponse.expires_in === 'number' && (tokenResponse.created_at + tokenResponse.expires_in) * 1000 <= Date.now();
}

function computeLoginInfoLocalStorageKey(origin: string): string {
    return `login:${origin}`;
}

function loadLoginInfo(origin: string): LoginInfo | undefined{
    const str = localStorage.getItem(computeLoginInfoLocalStorageKey(origin));
    const obj = typeof str === 'string' ? JSON.parse(str) : undefined;
    return isLoginInfo(obj) ? obj : undefined;
}

function saveLoginInfo(info: LoginInfo) {
    const { origin } = info;
    localStorage.setItem(computeLoginInfoLocalStorageKey(origin), JSON.stringify(info));
}

function deleteLoginInfo(origin: string) {
    localStorage.removeItem(computeLoginInfoLocalStorageKey(origin));
}

function computeMastodonIdForUrl(replyToUrl: string): string {
    // https://example.com/@user/123123123123123123
    const end = new URL(replyToUrl).pathname.split('/').pop() || '';
    checkTrue('mastodon replyToUrl', replyToUrl, /^\d+$/.test(end));
    return end;
}

//

interface LoginInfo {
    readonly origin: string;
    readonly tokenResponse: OauthObtainTokenResponse
}

// deno-lint-ignore no-explicit-any
function isLoginInfo(obj: any): obj is LoginInfo {
    return isObject(obj)
        && typeof obj.origin === 'string'
        && isOauthObtainTokenResponse(obj.tokenResponse)
        ;
}
