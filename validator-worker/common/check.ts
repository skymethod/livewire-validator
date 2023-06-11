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
