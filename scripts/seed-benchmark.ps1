param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(1200, 10000, 50000)]
  [int]$Size,

  [Parameter(Mandatory = $true)]
  [string]$PersistTo
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedPersist = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $PersistTo))
$wranglerRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot ".wrangler"))
if (-not $resolvedPersist.StartsWith($wranglerRoot, [StringComparison]::OrdinalIgnoreCase)) {
  throw "PersistTo must stay inside the repository .wrangler directory."
}

$templatePath = Join-Path $PSScriptRoot "benchmark-seed-template.sql"
$generatedPath = Join-Path $wranglerRoot "benchmark-seed-$Size.sql"
$sql = [IO.File]::ReadAllText($templatePath, [Text.Encoding]::UTF8).Replace("__ITEM_COUNT__", [string]$Size)
[IO.Directory]::CreateDirectory($wranglerRoot) | Out-Null
[IO.File]::WriteAllText($generatedPath, $sql, [Text.UTF8Encoding]::new($false))

Push-Location $repositoryRoot
try {
  & npx wrangler d1 execute MEDIA_LOG_DB --local --persist-to $resolvedPersist --file $generatedPath
  if ($LASTEXITCODE -ne 0) { throw "Benchmark seed failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}
