$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$releaseRoot = Join-Path $projectRoot '.release'
$buildId = Get-Date -Format 'yyyyMMdd-HHmmss'
$stageRoot = Join-Path $releaseRoot "stage-$buildId"
$archivePath = Join-Path $releaseRoot "syncecard-$buildId.zip"
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

function Copy-ReleaseDirectory([string]$Source, [string]$Destination) {
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  foreach ($entry in Get-ChildItem -LiteralPath $Source -Force) {
    if ($entry.Name -in @('node_modules', 'uploads', 'data', '.env', 'production.env', '.git')) { continue }
    if ($entry.Name -like '.env.*' -and $entry.Name -ne '.env.example') { continue }
    $target = Join-Path $Destination $entry.Name
    if ($entry.PSIsContainer) { Copy-ReleaseDirectory $entry.FullName $target }
    else { Copy-Item -LiteralPath $entry.FullName -Destination $target }
  }
}
foreach ($directory in @('backend','frontend','database','deploy','docs')) {
  Copy-ReleaseDirectory (Join-Path $projectRoot $directory) (Join-Path $stageRoot $directory)
}
foreach ($file in @('Dockerfile','docker-compose.yml','.dockerignore','README.md')) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $stageRoot $file)
}
if (Get-ChildItem -LiteralPath $stageRoot -Recurse -File -Force | Where-Object { $_.Name -in @('.env','production.env','users.json') }) {
  throw 'Private files found in release staging; archive not created.'
}
Compress-Archive -Path (Join-Path $stageRoot '*') -DestinationPath $archivePath
Write-Output $archivePath
