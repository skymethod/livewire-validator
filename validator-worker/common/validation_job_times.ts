export function formatTime(millis: number): string {
    if (millis < 1000) return `${millis}ms`;
    return `${Math.round(millis / 1000 * 100) / 100}s`;
}

export function computeJobTimesStringSuffix(times: ValidationJobTimes): string {
    const rt = [['fetch', times.fetchTime],['read', times.readTime],['parse', times.parseTime],['validate', times.validateTime],['comments', times.commentsTime]]
        .filter(v => v[1] !== undefined)
        .map(v => `${v[0]}=${formatTime(v[1] as number)}`)
        .join(', ');
    return rt === '' ? '' : ` (${rt})`;
}

//

export interface ValidationJobTimes {
    fetchTime?: number;
    readTime?: number;
    parseTime?: number;
    validateTime?: number;
    commentsTime?: number;
}
