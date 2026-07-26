import {
  PRIVATE_DEFAULT_ACTRESS,
  normalizePlatform,
  normalizeWorkCode
} from "../../shared/privateModel";
import { privateRowDraftToInput } from "./privateSpreadsheet";
import type { PrivateSimpleAddDraft } from "./privateSimpleAddDraft";

export type PrivateAddPlatform = "FC2" | "JAV" | "unknown";

export type PrivateAddDefaults = {
  code: string;
  platform: PrivateAddPlatform;
  maker: string;
  actress: string;
};

export type PrivateAddTouchedFields = {
  actress: boolean;
  platform: boolean;
  maker: boolean;
};

export function privateAddDefaultsForCode(value: string): PrivateAddDefaults {
  const code = normalizeWorkCode(value);
  const platform = normalizePlatform({ code });
  return {
    code,
    platform,
    maker: platform === "FC2" ? "FC2" : "",
    actress: PRIVATE_DEFAULT_ACTRESS
  };
}

export function applyPrivateAddCodeDefaults(
  draft: PrivateSimpleAddDraft,
  value: string,
  touched: PrivateAddTouchedFields
): PrivateSimpleAddDraft {
  const defaults = privateAddDefaultsForCode(value);
  return {
    ...draft,
    code: defaults.code,
    platform: touched.platform ? draft.platform : (defaults.platform === "unknown" ? "" : defaults.platform),
    maker: touched.maker ? draft.maker : defaults.maker,
    actress: touched.actress ? draft.actress : defaults.actress
  };
}

export function privateQuickAddToInput(draft: PrivateSimpleAddDraft) {
  return privateRowDraftToInput({
    code: draft.code,
    title: draft.title,
    rating: draft.rating,
    collection: draft.collection,
    actress: draft.actress,
    platform: draft.platform,
    maker: draft.maker,
    tags: draft.tags.join(", "),
    releaseDate: draft.release_date,
    watchedAt: draft.watched_at,
    summary: draft.summary
  });
}
