import { withLock } from "superlock";

export type State = {
  status?: "running" | "success" | "error"
  startTime?: number;
  endTime?: number;
  message?: string;
  progress?: number,
  total?: number
}

const lock = withLock();

export const state = storage.defineItem<State>("local:state")

export const setState = (updates: Partial<State>): Promise<void> => lock(async () => {
  const existing = await state.getValue()
  const newState = { ...existing, ...updates }
  await state.setValue(newState)
  logger.info("State changed:", newState)
})

export async function resetState(): Promise<void> {
  await state.removeValue()
}
