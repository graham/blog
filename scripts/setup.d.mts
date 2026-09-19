export function parseEnvFile(text: string): Record<string, string>;
export function deriveSiteUrl(values: Record<string, string>): string;
export function mergeEmailList(current: string | undefined, email: string): string;
