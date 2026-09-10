'use strict';
import { ExtensionContext } from 'vscode';
import { registerMarkdownTodos } from './markdownTodos';
import { registerOpenInApplication } from './openFile';

export async function activate(context: ExtensionContext): Promise<void> {
    registerMarkdownTodos(context);
    registerOpenInApplication(context);
}
