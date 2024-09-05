export function checkMatches(name: string, value: string, pattern: RegExp): string {
    if (!pattern.test(value)) throw new Error(`Bad ${name}: ${value}`);
    return value;
}

export function checkMatchesReturnMatcher(name: string, value: string, pattern: RegExp): RegExpExecArray {
    const m = pattern.exec(value);
    if (!m) throw new Error(`Bad ${name}: ${value}`);
    return m;
}

export function checkEqual<T>(name: string, value: T, expected: T) {
    if (value !== expected) throw new Error(`Bad ${name}: ${value}, expected ${expected}`);
}

export function checkTrue<T>(name: string, value: T, test: boolean) {
    if (!test) throw new Error(`Bad ${name}: ${value}`);
}

export function isStringRecord(obj: unknown): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && obj.constructor === Object;
}

export function isString(obj: unknown): obj is string {
    return typeof obj === 'string';
}

export function isOptionalString(obj: unknown): obj is string | undefined {
    return typeof obj === 'string' || obj === undefined;
}

export function isStringArray(obj: unknown): obj is string[] {
    return Array.isArray(obj) && obj.every(v => typeof v === 'string');
}

export function isOptionalStringArray(obj: unknown): obj is string[] | undefined {
    return isStringArray(obj) || obj === undefined;
}

export function isOptionalBoolean(obj: unknown): obj is boolean | undefined {
    return typeof obj === 'boolean' || obj === undefined;
}

export function isOptionalNumber(obj: unknown): obj is number | undefined {
    return typeof obj === 'number' || obj === undefined;
}

export function isOptional<T>(obj: unknown, validator: (v: unknown) => v is T): obj is T | undefined {
    return obj === undefined || validator(obj);
}
