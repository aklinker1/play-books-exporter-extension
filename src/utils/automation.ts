export type MaybePromise<T> = T | Promise<T>

type WaitOptions = {
  timeoutMs?: number
  intervalMs?: number
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function waitFor(label: string, fn: () => MaybePromise<boolean>, options: WaitOptions = {}): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10e3
  const intervalMs = options.intervalMs ?? 100
  const startTime = Date.now()

  while (true) {
    const result = await fn()
    if (result) return

    if (Date.now() - startTime > timeoutMs) throw Error(`Timed out after ${timeoutMs}ms waiting for ${label}`)

    await sleep(intervalMs)
  }
}

export async function waitForElement<T extends Element>(label: string, querySelector: string, options?: WaitOptions): Promise<T> {
  let element: T | null;

  await waitFor(label, () => {
    element = document.querySelector<T>(querySelector)
    return !!element
  }, options)

  return element!;
}

export async function waitForElementGone<T extends Element>(label: string, querySelector: string, options?: WaitOptions): Promise<void> {
  await waitFor(label, () => {
    const element = document.querySelector<T>(querySelector)
    return !element
  }, options)
}
