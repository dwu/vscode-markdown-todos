import * as path from 'path';

type FileUriLike = { scheme?: unknown; fsPath?: unknown };

export function getOpenFilePath(target?: unknown, activeTarget?: unknown): string | undefined {
    return getPathFromTarget(target === undefined ? activeTarget : target);
}

export function getPathFromTarget(target: unknown): string | undefined {
    if (typeof target !== 'object' || target === null) {
        return undefined;
    }

    const candidate = target as { path?: unknown; fsPath?: unknown; resourceUri?: unknown; scheme?: unknown };
    if (candidate.scheme !== undefined && candidate.scheme !== 'file') {
        return undefined;
    }
    if (candidate.scheme === 'file' && typeof candidate.fsPath === 'string') {
        return candidate.fsPath;
    }
    if (typeof candidate.path === 'string') {
        return candidate.path;
    }
    if (typeof candidate.fsPath === 'string') {
        return candidate.fsPath;
    }
    if (isFileUri(candidate.resourceUri)) {
        return candidate.resourceUri.fsPath as string;
    }

    return undefined;
}

export function resolveConfiguredApplication(applications: unknown, filePath: string): string | undefined {
    if (typeof applications !== 'object' || applications === null || Array.isArray(applications)) {
        return undefined;
    }

    const configuredApplications = applications as Record<string, unknown>;
    const extension = path.extname(filePath).replace(/^\./, '');
    const candidates = extension === '' ? ['*'] : [extension, `.${extension}`, '*'];

    for (const candidate of candidates) {
        const application = configuredApplications[candidate];
        if (typeof application === 'string' && application.trim() !== '') {
            return application.trim();
        }
    }

    return undefined;
}

export function isApplicationTemplate(application: string): boolean {
    return application.includes('%p') || application.includes('%f');
}

export function parseApplicationTemplate(template: string, filePath: string): { command: string; args: string[] } {
    const tokens = tokenizeCommand(template);
    if (tokens.length === 0) {
        throw new Error('The launcher command is empty');
    }

    const folderPath = path.dirname(filePath);
    const substitute = (value: string) => value.replace(/%[pf]/g, placeholder => placeholder === '%p' ? folderPath : filePath);
    const [command, ...args] = tokens.map(substitute);
    return { command, args };
}

export function tokenizeCommand(commandLine: string): string[] {
    const tokens: string[] = [];
    let token = '';
    let tokenStarted = false;
    let quote: string | undefined;
    let escaping = false;

    for (const character of commandLine) {
        if (escaping) {
            token += character;
            tokenStarted = true;
            escaping = false;
            continue;
        }

        if (quote !== undefined) {
            if (character === quote) {
                quote = undefined;
            } else {
                token += character;
            }
            tokenStarted = true;
            continue;
        }

        if (character === '"' || character === "'") {
            quote = character;
            tokenStarted = true;
        } else if (character === '\\' && process.platform !== 'win32') {
            escaping = true;
            tokenStarted = true;
        } else if (/\s/.test(character)) {
            if (tokenStarted) {
                tokens.push(token);
                token = '';
                tokenStarted = false;
            }
        } else {
            token += character;
            tokenStarted = true;
        }
    }

    if (escaping) {
        token += '\\';
    }
    if (quote !== undefined) {
        throw new Error('The launcher command contains an unterminated quote');
    }
    if (tokenStarted) {
        tokens.push(token);
    }

    return tokens;
}

function isFileUri(value: unknown): value is FileUriLike & { fsPath: string } {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const uri = value as FileUriLike;
    return uri.scheme === 'file' && typeof uri.fsPath === 'string';
}
