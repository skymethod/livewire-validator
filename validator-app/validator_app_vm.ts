import { checkEqual, checkMatches } from './check.ts';

export class ValidatorAppVM {

    private _status = '';
    get status(): string { return this._status; }

    private _messages: Message[] = [];
    get messages(): readonly Message[] { return this._messages; }

    onChange: () => void = () => {};

    start() {
        // load initial state, etc. noop for now
    }

    validateFeed(feedUrlStr: string) {
        feedUrlStr = feedUrlStr.trim();
        this._status = 'Validating ' + feedUrlStr;
        this._messages.splice(0);
        this.onChange();
        this.validateFeedAsync(feedUrlStr).catch(e => {
            this._messages.push({ type: 'error', text: e.message });
            this.onChange();
        })
    }

    //

    private async validateFeedAsync(feedUrlStr: string): Promise<void> {
        try {
            if (feedUrlStr === '') throw new Error(`Bad url: <blank>`);
            const feedUrl = tryParseUrl(feedUrlStr);
            if (!feedUrl) throw new Error(`Bad url: ${feedUrlStr}`);
            checkMatches('feedUrl.protocol', feedUrl.protocol, /^https?:$/);

            let res: Response | undefined;
            try {
                res = await fetch(feedUrl.toString());
                
            } catch (e) {
                this._messages.push({ type: 'warning', text: `Local fetch failed: CORS issue?` });
            }
            if (!res) {
                const url = feedUrl.toString();
                const headers = { 'Accept-Encoding': 'gzip', 'User-Agent': navigator.userAgent };
                res = await fetch('/fetch', { method: 'POST', body: JSON.stringify({ url, headers }) });
            }
            checkEqual('response.status', res.status, 200);
            this._messages.push({ type: 'info', text: `Response status=${res.status}, content-type=${res.headers.get('Content-Type')}, content-length=${res.headers.get('Content-Length')}` });
            const text = await res.text();

            this._messages.push({ type: 'info', text: `nice url! text length=${text.length}` });
        } catch (e) {
            this._messages.push({ type: 'error', text: e.message });
        } finally {
            this._status = '';
            this.onChange();
        }
    }

}

export type MessageType = 'error' | 'warning' | 'info';

export interface Message {
    readonly type: MessageType;
    readonly text: string;
}

//

function tryParseUrl(url: string): URL | undefined {
    try {
        return new URL(url);
    } catch {
        return undefined;
    }
}
