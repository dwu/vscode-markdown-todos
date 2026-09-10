import * as assert from 'assert';
import { parseMarkdownDocument } from '../parser';

suite('Markdown parser', () => {
    test('only closes fences with a matching marker, sufficient length and no trailing text', () => {
        for (const marker of ['`', '~']) {
            const parsed = parseMarkdownDocument([
                marker.repeat(4), marker.repeat(3), '- [ ] hidden short',
                marker.repeat(4) + 'text', '- [ ] hidden trailing text',
                (marker === '`' ? '~' : '`').repeat(4), '- [ ] hidden wrong marker',
                marker.repeat(5) + ' \t', '- [ ] visible'
            ].join('\n'));
            assert.deepStrictEqual(parsed.headlessTodos.map(todo => todo.text), ['visible']);
        }
    });

    test('backticks in the info string do not open a fence', () => {
        assert.strictEqual(parseMarkdownDocument('```invalid`info\n- [ ] visible').headlessTodos.length, 1);
    });

    test('parses supported task forms', () => {
        const parsed = parseMarkdownDocument([
            '- [ ] dash task',
            '* [x] star task',
            '+ [X] plus task'
        ].join('\n'));

        assert.deepStrictEqual(parsed.headlessTodos.map(todo => ({
            text: todo.text,
            isChecked: todo.isChecked,
            line: todo.line,
            indent: todo.indent
        })), [
            { text: 'dash task', isChecked: false, line: 0, indent: '' },
            { text: 'star task', isChecked: true, line: 1, indent: '' },
            { text: 'plus task', isChecked: true, line: 2, indent: '' }
        ]);
    });

    test('rejects invalid checkbox characters and prose that only contains a task-looking fragment', () => {
        const parsed = parseMarkdownDocument([
            'ordinary prose - [ ] accidental match',
            '- [?] invalid checkbox',
            '- [y] invalid checkbox',
            '- [ ] valid task'
        ].join('\n'));

        assert.deepStrictEqual(parsed.headlessTodos.map(todo => todo.text), ['valid task']);
    });

    test('ignores tasks inside backtick and tilde fenced code blocks', () => {
        const parsed = parseMarkdownDocument([
            '```markdown',
            '- [ ] backtick task',
            '```',
            '~~~markdown',
            '+ [ ] tilde task',
            '~~~',
            '- [ ] real task'
        ].join('\n'));

        assert.deepStrictEqual(parsed.headlessTodos.map(todo => todo.text), ['real task']);
    });

    test('accepts an empty task and preserves indentation', () => {
        const parsed = parseMarkdownDocument('\t  - [ ]   ');

        assert.deepStrictEqual(parsed.headlessTodos.map(todo => ({ text: todo.text, indent: todo.indent })), [
            { text: '', indent: '\t  ' }
        ]);
    });

    test('assigns tasks to the latest heading and omits headings without tasks', () => {
        const parsed = parseMarkdownDocument([
            '# First',
            '- [ ] first task',
            '## Empty',
            '### Third',
            '* [x] third task'
        ].join('\n'));

        assert.deepStrictEqual(parsed.heads.map(head => ({ text: head.text, line: head.line, todos: head.todos.map(todo => todo.text) })), [
            { text: 'First', line: 0, todos: ['first task'] },
            { text: 'Third', line: 3, todos: ['third task'] }
        ]);
    });
});
