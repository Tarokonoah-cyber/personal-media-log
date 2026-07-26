export const PRIVATE_SIMPLE_ADD_HISTORY_KEY = "__privateSimpleAddOpen";

type HistoryTarget = Pick<History, "state" | "pushState" | "replaceState" | "back">;

export function isPrivateSimpleAddHistoryEntry(state: unknown) {
  return Boolean(
    state
    && typeof state === "object"
    && !Array.isArray(state)
    && (state as Record<string, unknown>)[PRIVATE_SIMPLE_ADD_HISTORY_KEY] === true
  );
}

export function pushPrivateSimpleAddHistoryEntry(
  historyTarget: HistoryTarget = window.history,
  url = window.location.href
) {
  if (isPrivateSimpleAddHistoryEntry(historyTarget.state)) return false;
  const currentState = historyTarget.state && typeof historyTarget.state === "object" && !Array.isArray(historyTarget.state)
    ? historyTarget.state as Record<string, unknown>
    : {};
  historyTarget.pushState({ ...currentState, [PRIVATE_SIMPLE_ADD_HISTORY_KEY]: true }, "", url);
  return true;
}

export function popPrivateSimpleAddHistoryEntry(
  historyTarget: HistoryTarget = window.history
) {
  if (!isPrivateSimpleAddHistoryEntry(historyTarget.state)) return false;
  historyTarget.back();
  return true;
}

export function removeStalePrivateSimpleAddHistoryEntry(
  historyTarget: HistoryTarget = window.history,
  url = window.location.href
) {
  if (!isPrivateSimpleAddHistoryEntry(historyTarget.state)) return false;
  const nextState = { ...(historyTarget.state as Record<string, unknown>) };
  delete nextState[PRIVATE_SIMPLE_ADD_HISTORY_KEY];
  historyTarget.replaceState(nextState, "", url);
  return true;
}
