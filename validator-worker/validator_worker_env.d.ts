
export interface ValidatorWorkerEnv {
    readonly version?: string;
    readonly flags?: string;
    readonly twitter?: string;
    readonly pushId?: string;
    readonly piCredentials?: string; // apiKey:apiSecret
}
