import { checkEqual, checkMatches } from './check.ts';
import { parseFeedXml, validateFeedXml, ValidationCallbacks, XmlNode } from './validator.ts';

export class ValidatorAppVM {

    private _status = '';
    get status(): string { return this._status; }

    private _messages: Message[] = [];
    get messages(): readonly Message[] { return this._messages; }

    private _xml: XmlNode | undefined;
    get xml(): XmlNode | undefined { return this._xml; }

    onChange: () => void = () => {};

    start() {
        // load initial state, etc. noop for now
    }

    validateFeed(feedUrlStr: string) {
        feedUrlStr = feedUrlStr.trim();
        this._status = 'Validating ' + feedUrlStr;
        this._messages.splice(0);
        this._xml = undefined;
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

            feedUrl.searchParams.set('_t', Date.now().toString()); // cache bust

            let res: Response | undefined;
            let start = Date.now();
            let fetchTime = 0;
            const headers = { 'Accept-Encoding': 'gzip', 'User-Agent': navigator.userAgent, 'Cache-Control': 'no-store' };
            try {
                res = await fetch(feedUrl.toString(), { headers });
                fetchTime = Date.now() - start;
            } catch {
                this._messages.push({ type: 'warning', text: `Local fetch failed: CORS issue?` });
            }
            if (!res) {
                const url = feedUrl.toString();
                start = Date.now();
                res = await fetch('/fetch', { method: 'POST', body: JSON.stringify({ url, headers }) });
                fetchTime = Date.now() - start;
            }
            checkEqual('response.status', res.status, 200);
            this._messages.push({ type: 'info', text: `Response status=${res.status}, content-type=${res.headers.get('Content-Type')}, content-length=${res.headers.get('Content-Length')}` });

            start = Date.now();
            const text = await res.text();
            const readTime = Date.now() - start;

            start = Date.now();
            let parseTime = 0;
            let xml: XmlNode | undefined;
            try {
                xml = parseFeedXml(text);
            } catch (e) {
                this._messages.push({ type: 'error', text: `Xml parse failed: ${e.message}` });
            } finally {
                parseTime = Date.now() - start;
            }
            this._xml = xml;
          
            console.log(xml);

            let validateTime: number | undefined;
            if (xml) {
                start = Date.now();
                const callbacks: ValidationCallbacks = {
                    onError: (_, message) => {
                        console.error(message);
                        this._messages.push({ type: 'error', text: message });
                    },
                    onWarning: (_, message) =>  {
                        console.warn(message);
                        this._messages.push({ type: 'warning', text: message });
                    },
                    onInfo: (_, message) =>  {
                        console.info(message);
                        this._messages.push({ type: 'info', text: message });
                    },
                };
                validateFeedXml(xml, callbacks);
                validateTime = Date.now() - start;
            }

            this._messages.push({ type: 'info', text: JSON.stringify({ fetchTime, readTime, parseTime, validateTime, textLength: text.length }) });
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
