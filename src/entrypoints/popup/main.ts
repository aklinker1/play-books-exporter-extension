import type { State } from "@/utils/state";

declare const progress: HTMLParagraphElement;
declare const message: HTMLParagraphElement;

function render(state: State | null) {
  if (!state) {
    progress.textContent = "-/-";
    message.textContent = "";
    return;
  }

  progress.textContent = `${state.progress ?? "-"}/${state.total ?? "-"}`;
  message.textContent = state.message ?? "";
}

state.watch(render);
state.getValue().then(render)
