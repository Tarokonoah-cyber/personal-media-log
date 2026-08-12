import { Star } from "lucide-react";
import { privateRatingFromStars, privateStarsFromRating } from "../../shared/privateModel";

const starValues = [1, 2, 3, 4, 5] as const;

export function PrivateStarRating({
  value,
  onChange,
  disabled = false,
  active = true,
  compact = false,
  label = "評分",
  onKeyDown,
  autoFocus = false
}: {
  value: number | null;
  onChange: (rating: number | null) => void;
  disabled?: boolean;
  active?: boolean;
  compact?: boolean;
  label?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  autoFocus?: boolean;
}) {
  const selected = privateStarsFromRating(value);

  function update(stars: number) {
    onChange(stars === selected ? null : privateRatingFromStars(stars));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const movement = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 0;
    if (movement) {
      event.preventDefault();
      event.stopPropagation();
      const next = Math.min(5, Math.max(1, (selected || 1) + movement));
      onChange(privateRatingFromStars(next));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      onChange(privateRatingFromStars(event.key === "Home" ? 1 : 5));
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      onChange(null);
    } else if (event.key === "Enter" || event.key === " ") {
      event.stopPropagation();
    }
  }

  return (
    <span className={`private-star-rating${compact ? " is-compact" : ""}`} data-private-cell-control role="radiogroup" aria-label={label}>
      {starValues.map((star) => (
        <button
          key={star}
          autoFocus={autoFocus && star === (selected || 1)}
          type="button"
          className={star <= selected ? "is-filled" : ""}
          tabIndex={active && star === (selected || 1) ? 0 : -1}
          disabled={disabled}
          role="radio"
          aria-checked={star === selected}
          aria-label={`${star} 星`}
          title={`${star} 星${star === selected ? "，再次點擊可清除" : ""}`}
          onClick={() => update(star)}
          onKeyDown={handleKeyDown}
        >
          <Star size={compact ? 13 : 17} fill={star <= selected ? "currentColor" : "none"} />
        </button>
      ))}
    </span>
  );
}

export function PrivateStarDisplay({ value, label = "評分" }: { value: number | null; label?: string }) {
  const selected = privateStarsFromRating(value);
  if (!selected) return <span className="private-muted-cell">-</span>;
  return (
    <span className="private-star-display" aria-label={`${label}：${selected} 星`} title={`${selected} / 5 星`}>
      {starValues.map((star) => <Star key={star} size={13} fill={star <= selected ? "currentColor" : "none"} />)}
    </span>
  );
}
