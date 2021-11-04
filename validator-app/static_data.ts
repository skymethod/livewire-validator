export interface StaticData {
    readonly version?: string;
    readonly pushId?: string;
    readonly flags?: string;
    readonly debug?: Record<string, unknown>;
}
