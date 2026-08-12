import { useEffect, useState, type ReactNode } from "react";

export function CoverImage({
  src,
  alt = "",
  className,
  fallback,
  loading = "lazy"
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback: ReactNode;
  loading?: "eager" | "lazy";
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;
  return <img className={className} src={src} alt={alt} loading={loading} onError={() => setFailed(true)} />;
}
