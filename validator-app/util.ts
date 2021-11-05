// workaround for https://github.com/microsoft/TypeScript/issues/17002
// deno-lint-ignore no-explicit-any
export function isReadonlyArray(arg: any): arg is readonly any[] {
    return Array.isArray(arg);
}
