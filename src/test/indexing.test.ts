import * as assert from 'assert';
import { createMarkdownSearchScopes } from '../indexing';

suite('Markdown indexing configuration', () => {
    test('handles an empty exclusion object', () => {
        const scopes = createMarkdownSearchScopes(
            [{ path: '/workspace' }],
            () => ({})
        );

        assert.deepStrictEqual(scopes, [{ rootPath: '/workspace' }]);
    });

    test('ignores disabled exclusions', () => {
        const scopes = createMarkdownSearchScopes(
            [{ path: '/workspace' }],
            () => ({ '**/generated/**': false, '**/private/**': true })
        );

        assert.deepStrictEqual(scopes, [{ rootPath: '/workspace', exclude: '**/private/**' }]);
    });

    test('creates one independently configured scope for each workspace root', () => {
        const exclusions = new Map([
            ['/workspace/root-a', { '**/build/**': true }],
            ['/workspace/root-b', { '**/build/**': false, '**/vendor/**': true }]
        ]);
        const scopes = createMarkdownSearchScopes(
            [{ path: '/workspace/root-a' }, { path: '/workspace/root-b' }],
            rootPath => exclusions.get(rootPath)
        );

        assert.deepStrictEqual(scopes, [
            { rootPath: '/workspace/root-a', exclude: '**/build/**' },
            { rootPath: '/workspace/root-b', exclude: '**/vendor/**' }
        ]);
    });
});
