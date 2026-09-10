export type TodoLike = { isChecked: boolean };
export type HeadLike<Todo extends TodoLike> = { todos: Todo[] };
export type FileLike<Todo extends TodoLike, Head extends HeadLike<Todo>> = {
    path: string;
    headlessTodos: Todo[];
    heads: Head[];
};

export function countTodos(todos: TodoLike[]): { checked: number; unchecked: number } {
    return todos.reduce((counts, todo) => {
        if (todo.isChecked) {
            counts.checked++;
        } else {
            counts.unchecked++;
        }

        return counts;
    }, { checked: 0, unchecked: 0 });
}

export function visibleFiles<File extends FileLike<Todo, Head>, Todo extends TodoLike, Head extends HeadLike<Todo>>(
    files: File[],
    displayTicked: boolean
): File[] {
    return [...files]
        .filter(file => displayTicked || hasUncheckedTodos(file))
        .sort((left, right) => left.path.localeCompare(right.path));
}

export function visibleChildren<Todo extends TodoLike, Head extends HeadLike<Todo>>(
    file: FileLike<Todo, Head>,
    displayTicked: boolean
): Array<Todo | Head> {
    return [
        ...(displayTicked ? file.headlessTodos : file.headlessTodos.filter(todo => !todo.isChecked)),
        ...(displayTicked ? file.heads : file.heads.filter(head => head.todos.some(todo => !todo.isChecked)))
    ];
}

export function visibleHeadTodos<Todo extends TodoLike>(todos: Todo[], displayTicked: boolean): Todo[] {
    return displayTicked ? [...todos] : todos.filter(todo => !todo.isChecked);
}

function hasUncheckedTodos<Todo extends TodoLike, Head extends HeadLike<Todo>>(
    file: FileLike<Todo, Head>
): boolean {
    return file.headlessTodos.some(todo => !todo.isChecked) || file.heads.some(head => head.todos.some(todo => !todo.isChecked));
}
