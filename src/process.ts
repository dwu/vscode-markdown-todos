import { ChildProcess, spawn } from 'child_process';

const MAX_OUTPUT_LENGTH = 32 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export type LaunchMode = 'fire-and-forget' | 'diagnostic';

export function launchProcess(
    command: string,
    args: string[],
    mode: LaunchMode,
    spawnProcess: typeof spawn = spawn,
    timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> {
    return mode === 'fire-and-forget'
        ? launchWithoutWaiting(command, args, spawnProcess)
        : launchWithDiagnostics(command, args, spawnProcess, timeoutMs);
}

function launchWithoutWaiting(command: string, args: string[], spawnProcess: typeof spawn): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (callback: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            callback();
        };

        let child: ChildProcess;
        try {
            child = spawnProcess(command, args, {
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            });
        } catch (error) {
            finish(() => reject(error));
            return;
        }

        child.once('error', error => finish(() => reject(error)));
        child.once('spawn', () => finish(() => {
            child.unref();
            resolve();
        }));
    });
}

function launchWithDiagnostics(
    command: string,
    args: string[],
    spawnProcess: typeof spawn,
    timeoutMs: number
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let settled = false;
        let timeout: NodeJS.Timeout | undefined;
        const finish = (callback: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeout !== undefined) {
                clearTimeout(timeout);
            }
            callback();
        };
        const failure = (message: string) => {
            const output = [
                stdout === '' ? '' : `stdout:\n${stdout}`,
                stderr === '' ? '' : `stderr:\n${stderr}`
            ].filter(Boolean).join('\n');
            const details = output === '' ? '' : `\nCommand output:\n${output}`;
            finish(() => reject(new Error(`${message}${details}`)));
        };

        let child: ChildProcess;
        try {
            child = spawnProcess(command, args, {
                detached: false,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true
            });
        } catch (error) {
            finish(() => reject(error));
            return;
        }

        child.stdout?.on('data', data => {
            stdout = appendOutput(stdout, data.toString());
        });
        child.stderr?.on('data', data => {
            stderr = appendOutput(stderr, data.toString());
        });
        child.once('error', error => failure(error instanceof Error ? error.message : String(error)));
        child.once('close', (code, signal) => {
            if (code === 0) {
                finish(resolve);
            } else {
                const status = signal === null ? `code ${code}` : `signal ${signal}`;
                failure(`${command} exited with ${status}`);
            }
        });
        timeout = setTimeout(() => {
            // Release extension-host resources without terminating the user's application.
            child.stdout?.destroy();
            child.stderr?.destroy();
            child.unref();
            failure(`${command} did not exit within ${timeoutMs} ms`);
        }, timeoutMs);
    });
}

function appendOutput(current: string, chunk: string): string {
    return (current + chunk).slice(-MAX_OUTPUT_LENGTH);
}
