import { DurableObjectNamespace } from './deps_worker.ts';

export interface ValidatorWorkerEnv {
    readonly version?: string;
    readonly flags?: string;
    readonly twitter?: string;
    readonly pushId?: string;
    readonly piCredentials?: string; // apiKey:apiSecret
    readonly origin?: string;
    readonly mastodonClientName?: string;
    readonly mastodonClientUrl?: string;
    readonly storageNamespace?: DurableObjectNamespace;
    readonly twitterCredentials?: string;
    readonly cfAnalyticsToken?: string;
    readonly actorKeyId?: string;
    readonly actorPublicPemText?: string;
    readonly actorPrivatePemText?: string;
}
