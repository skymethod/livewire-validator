import { checkEqual } from './common/check.ts';
import { computeJobTimesStringSuffix, formatTime, ValidationJobTimes } from './common/validation_job_times.ts';
import { MessageOptions, validateFeedXml, ValidationCallbacks } from './common/validator.ts';
import { ExtendedXmlNode, parseXml } from './common/xml_parser.ts';

export async function validate(args: (string | number)[], _options: Record<string, unknown>) {
    const feedUrl = args[0];
    if (typeof feedUrl !== 'string') throw new Error('Must provide feedUrl');

    const jobStart = Date.now();
    const jobTimes: ValidationJobTimes = {};

    let start = Date.now();
    const res = await fetch(feedUrl);
    jobTimes.fetchTime = Date.now() - start;
    checkEqual('res.status', res.status, 200);

    start = Date.now();
    const text = await res.text();
    jobTimes.readTime = Date.now() - start;

    start = Date.now();
    const xml = parseXml(text);
    jobTimes.parseTime = Date.now() - start;

    const callbacks: ValidationCallbacks = {
        onGood: function (_node: ExtendedXmlNode, message: string, opts?: MessageOptions): void {
            console.log('onGood', message, opts);
        },
        onInfo: function (_node: ExtendedXmlNode, message: string, opts?: MessageOptions): void {
            console.log('onInfo', message, opts);
        },
        onError: function (_node: ExtendedXmlNode, message: string, opts?: MessageOptions): void {
            console.log('onError', message, opts);
        },
        onWarning: function (_node: ExtendedXmlNode, message: string, opts?: MessageOptions): void {
            console.log('onWarning', message, opts);
        },
        onPodcastIndexTagNamesFound: function (known: ReadonlySet<string>, unknown: ReadonlySet<string>, namespaceUris: ReadonlySet<string>): void {
            console.log('onPodcastIndexTagNamesFound', { known, unknown, namespaceUris });
        },
        onRssItemsFound: function (itemsCount: number, itemsWithEnclosuresCount: number): void {
            console.log('onRssItemsFound', {itemsCount, itemsWithEnclosuresCount } );
        }
    };
    start = Date.now();
    validateFeedXml(xml, callbacks);
    jobTimes.validateTime = Date.now() - start;
    console.log(`Took ${formatTime(Date.now() - jobStart)}${computeJobTimesStringSuffix(jobTimes)}`);
}
