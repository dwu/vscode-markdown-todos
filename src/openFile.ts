'use strict';
import { ExtensionContext, Uri, commands, window, workspace } from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

const applicationsConfiguration = 'markdown-todos.openInApplication';

export function registerOpenInApplication(context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand('markdown-todos.openInApplication', async (target?: unknown) => {
        await openFile(target, getConfiguredApplication);
    }));

    context.subscriptions.push(commands.registerCommand('markdown-todos.openWithApplication', async (target?: unknown) => {
        const application = await window.showInputBox({
            prompt: 'Enter the launcher application to use for this file',
            placeHolder: process.platform === 'darwin' ? 'Application name, for example Preview' : 'Launcher command, for example firefox',
            ignoreFocusOut: true
        });

        const trimmedApplication = application?.trim();
        if (!trimmedApplication) {
            return;
        }

        await openFile(target, () => trimmedApplication);
    }));
}

async function openFile(target: unknown, applicationForFile: (filePath: string) => string | undefined): Promise<void> {
    const filePath = getOpenFilePath(target);
    if (filePath === undefined) {
        void window.showErrorMessage('Open a file before opening it with an application.');
        return;
    }

    try {
        await openWithApplication(filePath, applicationForFile(filePath));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void window.showErrorMessage(`Unable to open ${filePath}: ${message}`);
    }
}

function getOpenFilePath(target?: unknown): string | undefined {
    const targetPath = getPathFromTarget(target);
    if (targetPath !== undefined) {
        return targetPath;
    }

    const activeUri = window.activeTextEditor?.document.uri;
    return activeUri?.scheme === 'file' ? activeUri.fsPath : undefined;
}

function getPathFromTarget(target: unknown): string | undefined {
    if (target instanceof Uri) {
        return target.scheme === 'file' ? target.fsPath : undefined;
    }

    if (typeof target !== 'object' || target === null) {
        return undefined;
    }

    const candidate = target as { path?: unknown; fsPath?: unknown; resourceUri?: unknown };
    if (typeof candidate.path === 'string') {
        return candidate.path;
    }
    if (typeof candidate.fsPath === 'string') {
        return candidate.fsPath;
    }
    if (candidate.resourceUri instanceof Uri && candidate.resourceUri.scheme === 'file') {
        return candidate.resourceUri.fsPath;
    }

    return undefined;
}

function getConfiguredApplication(filePath: string): string | undefined {
    const applications = workspace.getConfiguration(applicationsConfiguration).get<unknown>('applications');
    if (typeof applications !== 'object' || applications === null) {
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

function isApplicationTemplate(application: string): boolean {
    return application.includes('%p') || application.includes('%f');
}

function parseApplicationTemplate(template: string, filePath: string): { command: string; args: string[] } {
    const tokens = tokenizeCommand(template);
    if (tokens.length === 0) {
        throw new Error('The launcher command is empty');
    }

    const folderPath = path.dirname(filePath);
    const substitute = (value: string) => value.replace(/%p/g, folderPath).replace(/%f/g, filePath);
    const [command, ...args] = tokens.map(substitute);
    return { command, args };
}

function tokenizeCommand(commandLine: string): string[] {
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

function openWithApplication(filePath: string, application?: string): Promise<void> {
    let command: string;
    let args: string[];

    if (application !== undefined && isApplicationTemplate(application)) {
        ({ command, args } = parseApplicationTemplate(application, filePath));
    } else if (application !== undefined) {
        if (process.platform === 'darwin') {
            command = 'open';
            args = ['-a', application, filePath];
        } else {
            command = application;
            args = [filePath];
        }
    } else {
        switch (process.platform) {
            case 'darwin':
                command = 'open';
                args = [filePath];
                break;
            case 'win32':
                command = 'explorer.exe';
                args = [filePath];
                break;
            case 'linux':
                command = 'xdg-open';
                args = [filePath];
                break;
            default:
                return Promise.reject(new Error(`Unsupported platform: ${process.platform}`));
        }
    }

    return new Promise<void>((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        const opener = spawn(command, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        opener.stdout?.on('data', data => {
            stdout += data.toString();
        });
        opener.stderr?.on('data', data => {
            stderr += data.toString();
        });
        opener.once('error', reject);
        opener.once('close', code => {
            if (code === 0) {
                resolve();
            } else {
                const output = [
                    stdout.trim() === '' ? '' : `stdout:\n${stdout.trim()}`,
                    stderr.trim() === '' ? '' : `stderr:\n${stderr.trim()}`
                ].filter(Boolean).join('\n');
                const details = output === '' ? '' : `\nCommand output:\n${output}`;
                reject(new Error(`${command} exited with code ${code}${details}`));
            }
        });
        opener.unref();
    });
}
