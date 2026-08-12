import { Search, X } from "lucide-react";
import { useState } from "react";
import type { MediaItem, TmdbCandidate } from "../types";
import { CoverImage } from "./CoverImage";

export function MetadataLookupModal({
  item,
  query,
  candidates,
  loading,
  error,
  onSearch,
  onApply,
  onClose
}: {
  item: MediaItem;
  query: string;
  candidates: TmdbCandidate[];
  loading: boolean;
  error: string;
  onSearch: (query: string) => Promise<void>;
  onApply: (candidate: TmdbCandidate) => Promise<void>;
  onClose: () => void;
}) {
  const [searchText, setSearchText] = useState(query || item.official_title || item.raw_title);

  return (
    <div className="metadata-backdrop">
      <section className="metadata-modal" role="dialog" aria-modal="true" aria-label="補資料候選清單">
        <header className="metadata-head">
          <div>
            <p className="eyebrow">TMDb 補資料</p>
            <h2>{item.official_title || item.raw_title}</h2>
          </div>
          <button className="row-icon" onClick={onClose} aria-label="關閉"><X size={17} /></button>
        </header>
        <form className="metadata-search" onSubmit={(event) => { event.preventDefault(); void onSearch(searchText); }}>
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜尋 TMDb，例如：紙牌屋" />
          <button className="primary" disabled={loading || !searchText.trim()}><Search size={15} />搜尋</button>
        </form>
        {error && <div className="notice danger">{error}</div>}
        {loading && <div className="empty">正在搜尋 TMDb...</div>}
        {!loading && candidates.length === 0 && !error && <div className="empty">沒有找到候選結果，可以保留原本資料手動整理。</div>}
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <button className="candidate-row" key={`${candidate.media_type}-${candidate.tmdb_id}`} onClick={() => onApply(candidate)}>
              <CoverImage src={candidate.poster_url} fallback={<span className="poster-placeholder">無海報</span>} />
              <span className="candidate-main">
                <strong>{candidate.title}</strong>
                <em>{candidate.original_title || "-"}</em>
                <span className="candidate-meta">
                  <b>{candidate.media_type === "tv" ? "影集" : "電影"}</b>
                  {candidate.year && <span>{candidate.year}</span>}
                  {candidate.country.length > 0 && <span>{candidate.country.join(", ")}</span>}
                </span>
                {candidate.genres.length > 0 && <span className="mini-tags">{candidate.genres.slice(0, 5).map((genre) => <span key={genre}>{genre}</span>)}</span>}
              </span>
              <span className="candidate-action">套用</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
