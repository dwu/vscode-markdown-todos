import * as assert from 'assert';
import { getOpenFilePath, getPathFromTarget, parseApplicationTemplate, resolveConfiguredApplication, tokenizeCommand } from '../launcher';

suite('Launcher configuration', () => {
    test('resolves a target before falling back to the active editor', () => {
        assert.strictEqual(getOpenFilePath({ path: '/workspace/tasks.md' }, { scheme: 'file', fsPath: '/workspace/active.md' }), '/workspace/tasks.md');
        assert.strictEqual(getOpenFilePath(undefined, { scheme: 'file', fsPath: '/workspace/active.md' }), '/workspace/active.md');
        assert.strictEqual(getPathFromTarget({ resourceUri: { scheme: 'untitled', fsPath: '/workspace/nope.md' } }), undefined);
    });

    test('resolves extension and fallback launcher settings', () => {
        const applications = { md: '  editor %f  ', '.pdf': 'reader', '*': 'fallback' };
        assert.strictEqual(resolveConfiguredApplication(applications, '/workspace/tasks.md'), 'editor %f');
        assert.strictEqual(resolveConfiguredApplication(applications, '/workspace/report.pdf'), 'reader');
        assert.strictEqual(resolveConfiguredApplication(applications, '/workspace/image.png'), 'fallback');
        assert.strictEqual(resolveConfiguredApplication(false, '/workspace/tasks.md'), undefined);
    });

    test('tokenizes quoted, escaped, and template launcher arguments', () => {
        assert.deepStrictEqual(tokenizeCommand('editor --title "My Tasks" file\\ name.md'), ['editor', '--title', 'My Tasks', 'file name.md']);
        assert.deepStrictEqual(parseApplicationTemplate('editor --folder "%p" "%f"', '/workspace/my tasks.md'), {
            command: 'editor',
            args: ['--folder', '/workspace', '/workspace/my tasks.md']
        });
    });

    test('rejects an unterminated launcher quote', () => {
        assert.throws(() => tokenizeCommand('editor "unfinished'), /unterminated quote/);
    });
});
