import * as assert from 'assert';
import { SerialQueue } from '../asyncQueue';

suite('Serial queue', () => {
    test('waits for an earlier operation before starting a later one', async () => {
        const queue = new SerialQueue();
        const events: string[] = [];
        let releaseFirst: () => void = () => undefined;
        const firstReleased = new Promise<void>(resolve => {
            releaseFirst = resolve;
        });

        const first = queue.enqueue(async () => {
            events.push('first-start');
            await firstReleased;
            events.push('first-end');
        });
        const second = queue.enqueue(() => {
            events.push('second');
        });

        await Promise.resolve();
        assert.deepStrictEqual(events, ['first-start']);
        releaseFirst();
        await Promise.all([first, second]);
        assert.deepStrictEqual(events, ['first-start', 'first-end', 'second']);
    });

    test('continues processing after an operation fails', async () => {
        const queue = new SerialQueue();
        const expectedError = new Error('first failed');
        const first = queue.enqueue(() => Promise.reject(expectedError));
        const second = queue.enqueue(() => undefined);

        await assert.rejects(first, expectedError);
        await second;
    });
});
