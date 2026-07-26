import { useEffect, useMemo, useState } from "react";
import { normalizeWorkCode } from "../../shared/privateModel";
import { checkPrivateCodeConflict } from "../lib/api";
import type { PrivateCodeConflict } from "../types";

export type PrivateCodeConflictState = {
  normalizedCode: string;
  status: "idle" | "checking" | "clear" | "conflict" | "error";
  conflict: PrivateCodeConflict | null;
};

export function usePrivateCodeConflict(code: string, delay = 350): PrivateCodeConflictState {
  const normalizedCode = useMemo(() => normalizeWorkCode(code), [code]);
  const [state, setState] = useState<Omit<PrivateCodeConflictState, "normalizedCode">>({
    status: "idle",
    conflict: null
  });

  useEffect(() => {
    if (!normalizedCode) {
      setState({ status: "idle", conflict: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: "idle", conflict: null });
    const timer = window.setTimeout(() => {
      setState({ status: "checking", conflict: null });
      void checkPrivateCodeConflict(normalizedCode, controller.signal)
        .then(({ conflict }) => {
          setState({ status: conflict ? "conflict" : "clear", conflict });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ status: "error", conflict: null });
        });
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [delay, normalizedCode]);

  return { normalizedCode, ...state };
}
