import { defineConfig } from '@vscode/test-cli';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceFolder = resolve('.vscode-test/workspace');
mkdirSync(workspaceFolder, { recursive: true });

export default defineConfig({
	files: 'out/test/**/*.test.js',
    workspaceFolder,
});
