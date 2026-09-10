import * as assert from 'assert';

import * as vscode from 'vscode';
import { TodoTreeDataProvider } from '../markdownTodos';

suite('Extension activation', () => {
    test('activates and registers the refresh command', async () => {
        const extension = vscode.extensions.all.find(candidate => candidate.packageJSON.name === 'markdown-todos');
        assert.ok(extension, 'The markdown-todos extension should be available in the test host');

        await extension.activate();
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('markdown-todos.refresh'));
    });
});

suite('Workspace tree updates', function () {
    this.timeout(15_000);
    let provider: TodoTreeDataProvider;
    let directory: vscode.Uri;

    setup(async () => {
        const root = vscode.workspace.workspaceFolders?.[0];
        assert.ok(root, 'Integration tests require the configured test workspace');
        directory = vscode.Uri.joinPath(root.uri, `regression-${Date.now()}`);
        await vscode.workspace.fs.createDirectory(directory);
        provider = new TodoTreeDataProvider();
        await provider.reindex();
    });

    teardown(async () => {
        provider.dispose();
        await vscode.workspace.fs.delete(directory, { recursive: true });
    });

    async function write(name: string, text: string): Promise<vscode.Uri> {
        const uri = vscode.Uri.joinPath(directory, name);
        await vscode.workspace.fs.writeFile(uri, Buffer.from(text));
        return uri;
    }

    async function waitFor(condition: () => boolean): Promise<void> {
        const deadline = Date.now() + 10_000;
        while (!condition()) {
            assert.ok(Date.now() < deadline, 'Timed out waiting for a watcher update');
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    function hasFile(uri: vscode.Uri): boolean {
        return provider.getChildren()?.some(item => item.type === 'file' && item.path === uri.fsPath) ?? false;
    }

    test('deleting an untracked file preserves tracked files', async () => {
        const tracked = await write('tracked.md', '- [ ] keep');
        const empty = await write('empty.md', 'no tasks');
        await provider.reindex();
        await vscode.workspace.fs.delete(empty);
        // Wait for the queued deletion before observing a subsequent creation.
        const sentinel = await write('sentinel.md', '- [ ] sentinel');
        await waitFor(() => hasFile(sentinel));
        assert.ok(hasFile(tracked));
    });

    test('saved tasks update root visibility and emit a root refresh', async () => {
        const uri = await write('tasks.md', '- [ ] pending');
        await waitFor(() => hasFile(uri));
        let rootRefreshes = 0;
        const subscription = provider.onDidChangeTreeData(item => {
            if (item === undefined) { rootRefreshes++; }
        });
        try {
            await write('tasks.md', '- [x] done');
            await waitFor(() => !hasFile(uri));
            assert.ok(rootRefreshes > 0);
            await write('tasks.md', '- [ ] pending again');
            await waitFor(() => hasFile(uri));
        } finally {
            subscription.dispose();
        }
    });

    test('watcher updates respect search exclusions and literal filenames', async () => {
        const config = vscode.workspace.getConfiguration('search', directory);
        const original = config.inspect('exclude')?.workspaceValue;
        await config.update('exclude', { '**/excluded.md': true }, vscode.ConfigurationTarget.Workspace);
        try {
            const excluded = await write('excluded.md', '- [ ] hidden');
            const included = await write('tasks[1].md', '- [ ] visible');
            await waitFor(() => hasFile(included));
            assert.ok(!hasFile(excluded));
            await provider.reindex();
            assert.ok(!hasFile(excluded));
            assert.ok(hasFile(included));
        } finally {
            await config.update('exclude', original, vscode.ConfigurationTarget.Workspace);
        }
    });

    test('empty search exclusions do not implicitly apply files.exclude', async () => {
        const search = vscode.workspace.getConfiguration('search', directory);
        const files = vscode.workspace.getConfiguration('files', directory);
        const originalSearch = search.inspect('exclude')?.workspaceValue;
        const originalFiles = files.inspect('exclude')?.workspaceValue;
        const disabled = Object.fromEntries(Object.keys(search.get<object>('exclude') ?? {}).map(key => [key, false]));
        try {
            await search.update('exclude', disabled, vscode.ConfigurationTarget.Workspace);
            await files.update('exclude', { '**/hidden.md': true }, vscode.ConfigurationTarget.Workspace);
            const uri = await write('hidden.md', '- [ ] searchable');
            await provider.reindex();
            assert.ok(hasFile(uri));
        } finally {
            await search.update('exclude', originalSearch, vscode.ConfigurationTarget.Workspace);
            await files.update('exclude', originalFiles, vscode.ConfigurationTarget.Workspace);
        }
    });
});
