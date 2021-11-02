export function checkMatches(name: string, value: string, pattern: RegExp): string {
    if (!pattern.test(value)) throw new Error(`Bad ${name}: ${value}`);
    return value;
}

export function checkEqual<T>(name: string, value: T, expected: T) {
    if (value !== expected) throw new Error(`Bad ${name}: ${value}, expected ${expected}`);
}

export function checkTrue<T>(name: string, value: T, test: boolean) {
    if (!test) throw new Error(`Bad ${name}: ${value}`);
}
