Custom version of the [vscode-markdown-todo](https://github.com/TomasHubelbauer/vscode-markdown-todo) extension with changes to adapt the plugin to my preferences and minimal dependencies. See the [changelog](CHANGELOG.md) for a list of changes.

Files can be opened with their operating system's default application using the `Open in Application` command. The command is available from the Command Palette, the Explorer and editor context menus, and file items in the MarkDown To-Dos views.

The default command uses a launcher command configured for the file extension when one is present. Configure launchers in settings, using either an extension with or without its leading dot and `*` as an optional fallback. Launcher values may be a bare application name or a command string. In command strings, `%p` is replaced with the file's parent folder and `%f` with its full path:

```json
{
  "markdown-todos.openInApplication.applications": {
    "html": "firefox %f",
    "pdf": "evince %f",
    "*": "code --reuse-window %f",
    "special": "my-launcher --directory %p --file %f"
  }
}
```

The `Open with Application...` context menu command prompts for a launcher command and uses that choice once without changing the settings. It supports the same `%p` and `%f` parameters.

Build and package via: `npm install && ./node_modules/.bin/vsce package`
