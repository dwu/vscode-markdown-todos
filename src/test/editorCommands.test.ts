import * as assert from 'assert';
import { getAngleBracketFileName, toggleMarkdownCheckbox } from '../editorCommandUtils';

suite('Editor command helpers', () => {
    test('toggles supported Markdown task markers and preserves the rest of the line', () => {
        assert.strictEqual(toggleMarkdownCheckbox('  - [ ] pending task'), '  - [x] pending task');
        assert.strictEqual(toggleMarkdownCheckbox('\t* [x] finished task'), '\t* [ ] finished task');
        assert.strictEqual(toggleMarkdownCheckbox('+ [X] finished task'), '+ [ ] finished task');
    });

    test('does not toggle invalid or embedded checkbox-looking text', () => {
        assert.strictEqual(toggleMarkdownCheckbox('text - [ ] not a task'), undefined);
        assert.strictEqual(toggleMarkdownCheckbox('- [?] invalid task'), undefined);
        assert.strictEqual(toggleMarkdownCheckbox('- [ ]attached text'), undefined);
    });

    test('extracts a non-empty angle-bracketed file name from a line', () => {
        assert.strictEqual(getAngleBracketFileName('- [ ] review [notes](<docs/my notes.md>)'), 'docs/my notes.md');
        assert.strictEqual(getAngleBracketFileName('<README.md>'), 'README.md');
        assert.strictEqual(getAngleBracketFileName('no file reference here'), undefined);
        assert.strictEqual(getAngleBracketFileName('<>'), undefined);
    });
});
