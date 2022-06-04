import { isHttpOrFileUrl } from './common/validation_functions.ts';
import { Fetcher, MessageType, PISearchFetcher, ValidationJobVM } from './common/validation_job_vm.ts';
import { Theme } from './common/theme.ts';
import { fileExists, toFileUrl } from './deps_cli.ts';

export async function validate(args: (string | number)[], options: Record<string, unknown>) {
    const feedArg = args[0];
    if (typeof feedArg !== 'string') throw new Error('Must provide feed');
    const feedUrl = await fileExists(feedArg) ? toFileUrl(feedArg).toString() : feedArg;
    if (!isHttpOrFileUrl(feedUrl)) throw new Error('Must provide an absolute feed url or a local file path to an existing feed file');

    const validateComments = !!options.comments;

    const localFetcher: Fetcher = (url, headers) => {
        if (new URL(feedUrl).protocol === 'file:') {
            return fetch(url, { headers });
        }
        return fetchWithCorsConstraints(url, headers);
    };
    const remoteFetcher: Fetcher = (url, headers) => fetch(url, { headers });
    const piSearchFetcher: PISearchFetcher = () => { return Promise.resolve(new Response('{}')) };
    const threadcapUserAgent = 'validator cli';
    const vm = new ValidationJobVM({ localFetcher, remoteFetcher, piSearchFetcher, threadcapUserAgent });

    let onResolveValidationDone = (_: unknown) => {};
    const validationDone = new Promise(resolve => onResolveValidationDone = resolve);
    vm.onChange = () => {
        if (vm.done) {
            onResolveValidationDone(void 0);
        }
    };

    vm.startValidation(feedUrl, { userAgent: 'foo', validateComments });
    await validationDone;
    console.log('validationDone');
    for (const message of vm.messages) {
        console.log(`%c${message.text}`, `color: ${computeMessageColor(message.type)}`);
    }
}

//

function computeMessageColor(type: MessageType): string {
    // 'error' | 'warning' | 'info' | 'done' | 'running' | 'good';
    if (type === 'error') return '#b71c1c';
    if (type === 'warning') return '#e65100';
    if (type === 'good') return '#43a047';
    return Theme.textColorSecondaryHex;
}

async function fetchWithCorsConstraints(url: string, headers?: Record<string, string>): Promise<Response> {
    const res = await fetch(url, { headers });
    const accessControlAllowOrigin = res.headers.get('access-control-allow-origin');
    if (!accessControlAllowOrigin) throw new Error(`No 'Access-Control-Allow-Origin' header found in the response`);
    if (accessControlAllowOrigin !== '*') throw new Error(`Bad 'Access-Control-Allow-Origin' header value '${accessControlAllowOrigin}', must be '*' to allow access from any origin`);
    return res;
}
