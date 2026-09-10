import * as assert from 'assert';
import { countTodos, visibleChildren, visibleFiles, visibleHeadTodos } from '../treeItems';

suite('Tree item filtering', () => {
    const unchecked = { isChecked: false, text: 'open' };
    const checked = { isChecked: true, text: 'done' };
    const fileWithOpenTodo = { path: '/workspace/z.md', headlessTodos: [unchecked], heads: [] };
    const fileWithOnlyDoneTodos = { path: '/workspace/a.md', headlessTodos: [checked], heads: [] };

    test('counts checked and unchecked todos', () => {
        assert.deepStrictEqual(countTodos([unchecked, checked]), { checked: 1, unchecked: 1 });
    });

    test('filters unchecked files and sorts visible files by path', () => {
        assert.deepStrictEqual(visibleFiles([fileWithOpenTodo, fileWithOnlyDoneTodos], false), [fileWithOpenTodo]);
        assert.deepStrictEqual(visibleFiles([fileWithOpenTodo, fileWithOnlyDoneTodos], true), [fileWithOnlyDoneTodos, fileWithOpenTodo]);
    });

    test('filters file and heading children when ticked todos are hidden', () => {
        const head = { todos: [checked, unchecked], text: 'Heading' };
        const file = { path: '/workspace/tasks.md', headlessTodos: [checked, unchecked], heads: [head] };

        assert.deepStrictEqual(visibleChildren(file, false), [unchecked, head]);
        assert.deepStrictEqual(visibleHeadTodos(head.todos, false), [unchecked]);
        assert.deepStrictEqual(visibleChildren(file, true), [checked, unchecked, head]);
    });
});
