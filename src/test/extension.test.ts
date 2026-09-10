import * as assert from 'assert';

import * as vscode from 'vscode';

suite('Extension activation', () => {
    test('activates and registers the refresh command', async () => {
        const extension = vscode.extensions.all.find(candidate => candidate.packageJSON.name === 'markdown-todos');
        assert.ok(extension, 'The markdown-todos extension should be available in the test host');

        await extension.activate();
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('markdown-todos.refresh'));
    });
});
