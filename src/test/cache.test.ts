import * as assert from 'assert';
import { removeFileFromCache } from '../cache';

suite('Cache updates', () => {
    test('deleting an untracked Markdown file leaves tracked files in the cache', () => {
        const trackedFile = { path: '/workspace/tasks.md' };
        const cache = [trackedFile];

        const changed = removeFileFromCache(cache, '/workspace/notes.md');

        assert.strictEqual(changed, false);
        assert.deepStrictEqual(cache, [trackedFile]);
    });
});
