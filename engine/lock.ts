/**
 * One task at a time on a shared resource (the browser's single database
 * connection). A sandbox attempt is one task, so no other query can run in the
 * middle of its transaction.
 */
export function createLock(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
