import * as assert from 'assert';
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
import { launchProcess } from '../process';
import { PassThrough } from 'stream';

function fakeChild(withOutput = false): ChildProcess & { emit: EventEmitter['emit'] } {
    const child = new EventEmitter() as ChildProcess & { emit: EventEmitter['emit'] };
    child.unref = () => child;
    if (withOutput) {
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
    }
    return child;
}

suite('Launcher process lifecycle', () => {
    test('fire-and-forget launch resolves on spawn without waiting for close', async () => {
        const child = fakeChild();
        let options: unknown;
        const spawnProcess = ((_: string, __: string[], spawnOptions: unknown) => {
            options = spawnOptions;
            process.nextTick(() => child.emit('spawn'));
            return child;
        }) as unknown as typeof import('child_process').spawn;

        await launchProcess('xdg-open', ['/workspace/tasks.md'], 'fire-and-forget', spawnProcess);

        assert.deepStrictEqual(options, { detached: true, stdio: 'ignore', windowsHide: true });
    });

    test('fire-and-forget launch rejects spawn errors', async () => {
        const child = fakeChild();
        const spawnProcess = ((_: string, __: string[]) => {
            process.nextTick(() => child.emit('error', new Error('launcher missing')));
            return child;
        }) as unknown as typeof import('child_process').spawn;

        await assert.rejects(
            launchProcess('missing-launcher', [], 'fire-and-forget', spawnProcess),
            /launcher missing/
        );
    });

    test('diagnostic launch caps output and rejects when the process times out', async () => {
        const child = fakeChild(true);
        let unreferenced = false;
        child.unref = () => { unreferenced = true; };
        const spawnProcess = ((_: string, __: string[]) => {
            process.nextTick(() => {
                child.stdout?.emit('data', 'a'.repeat(40_000));
                child.stderr?.emit('data', 'diagnostic');
            });
            return child;
        }) as unknown as typeof import('child_process').spawn;

        await assert.rejects(
            launchProcess('slow-launcher', [], 'diagnostic', spawnProcess, 5),
            error => error instanceof Error && error.message.startsWith('slow-launcher did not exit within 5 ms') &&
                error.message.includes('stdout:\n' + 'a'.repeat(32_768)) &&
                !error.message.includes('a'.repeat(32_769)) &&
                error.message.includes('stderr:\ndiagnostic')
        );
        assert.ok(child.stdout?.destroyed);
        assert.ok(child.stderr?.destroyed);
        assert.ok(unreferenced);
    });
});
