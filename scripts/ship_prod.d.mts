export function assertSafeProdShipEnv(env: NodeJS.ProcessEnv): void;
export function deployMessageFromArgv(argv: string[], fallback: string): string;
export function prodShipCommands(message: string): Array<[string, string[]]>;
