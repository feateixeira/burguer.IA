export type AutoAcceptProcessor = (orderId: string) => Promise<void>;

let processor: AutoAcceptProcessor | null = null;

export function registerAutoAcceptProcessor(fn: AutoAcceptProcessor | null) {
  processor = fn;
}

export function getAutoAcceptProcessor(): AutoAcceptProcessor | null {
  return processor;
}
