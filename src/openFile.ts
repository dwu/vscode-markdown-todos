'use strict';
import { ExtensionContext, Uri, commands, window, workspace } from 'vscode';
import { spawn } from 'child_process';
import { getOpenFilePath as resolveOpenFilePath, isApplicationTemplate, parseApplicationTemplate, resolveConfiguredApplication } from './launcher';

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
    return resolveOpenFilePath(target, window.activeTextEditor?.document.uri);
}

function getConfiguredApplication(filePath: string): string | undefined {
    const applications = workspace.getConfiguration(applicationsConfiguration).get<unknown>('applications');
    return resolveConfiguredApplication(applications, filePath);
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
