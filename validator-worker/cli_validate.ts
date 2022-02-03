import { isUrl } from './common/validation_functions.ts';
import { Fetcher, MessageType, PISearchFetcher, ValidationJobVM } from './common/validation_job_vm.ts';
import { Theme } from './common/theme.ts';

export async function validate(args: (string | number)[], options: Record<string, unknown>) {
    const feedUrl = args[0];
    if (typeof feedUrl !== 'string') throw new Error('Must provide feedUrl');
    if (!isUrl(feedUrl)) throw new Error('Must provide an absolute url for feedUrl');

    const validateComments = !!options.comments;

    const localFetcher: Fetcher = fetchWithCorsConstraints;
    const remoteFetcher: Fetcher = (url, headers) => fetch(url, { headers });
    const piSearchFetcher: PISearchFetcher = () => { return Promise.resolve(new Response('{}')) };
    const vm = new ValidationJobVM({ localFetcher, remoteFetcher, piSearchFetcher });

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
