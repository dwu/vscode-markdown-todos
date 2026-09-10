export class SerialQueue {
    private tail: Promise<void> = Promise.resolve();

    public enqueue(operation: () => Promise<void> | void): Promise<void> {
        const next = this.tail.then(operation, operation);
        this.tail = next.catch(() => undefined);
        return next;
    }
}
