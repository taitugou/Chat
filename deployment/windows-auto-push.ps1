param(
  [switch]$NoPull,
  [switch]$NoPush,
  [switch]$Commit,
  [string]$Message,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

$argsList = @()

if ($Commit) { $argsList += "--commit" }
if ($Message -and $Message.Trim().Length -gt 0) { $argsList += @("--message", $Message) }
if ($NoPull) { $argsList += "--no-pull" }
if ($NoPush) { $argsList += "--no-push" }
if ($DryRun) { $argsList += "--dry-run" }

if ($argsList.Count -gt 0) {
  npm run git:sync -- $argsList
} else {
  npm run git:sync
}

