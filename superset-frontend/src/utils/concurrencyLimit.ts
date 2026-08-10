export function createConcurrencyLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active -= 1;
    const next = queue.shift();
    if (next) {
      next();
    }
  };

  return function limited<T>(task: () => Promise<T>): Promise<T> {
    if (!(limit > 0)) {
      return task();
    }

    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active += 1;
        let pending: Promise<T>;
        try {
          pending = task();
        } catch (error) {
          release();
          reject(error);
          return;
        }
        pending.then(
          value => {
            release();
            resolve(value);
          },
          error => {
            release();
            reject(error);
          },
        );
      };

      if (active < limit) {
        start();
      } else {
        queue.push(start);
      }
    });
  };
}

export default createConcurrencyLimiter;
