# Enables "Allow Scripts to Write Files and Access Network" in After Effects preferences.
# Conservative: only edits an existing key whose value is "0", only while After Effects is closed,
# and keeps a .bak copy. If nothing matches, it does nothing (set the option manually then).
if (Get-Process AfterFX -ErrorAction SilentlyContinue) {
    Write-Host "After Effects is running - skipped. Enable the scripting option manually (see README)."
    exit 0
}
$root = Join-Path $env:APPDATA 'Adobe\After Effects'
if (-not (Test-Path $root)) { Write-Host "No After Effects preferences yet - nothing to change."; exit 0 }
$changed = 0
Get-ChildItem $root -Recurse -Filter '*indep-general*.txt' -ErrorAction SilentlyContinue | ForEach-Object {
    $t = [IO.File]::ReadAllText($_.FullName)
    if ($t -match '"Pref_SCRIPTING_FILE_NETWORK_SECURITY"\s*=\s*"0"') {
        Copy-Item $_.FullName ($_.FullName + '.bak') -Force
        $t = $t -replace '("Pref_SCRIPTING_FILE_NETWORK_SECURITY"\s*=\s*)"0"', '$1"1"'
        [IO.File]::WriteAllText($_.FullName, $t, (New-Object Text.UTF8Encoding $false))
        Write-Host "Enabled in $($_.FullName)"
        $changed++
    }
}
if ($changed -eq 0) { Write-Host "Not changed automatically - enable it manually in After Effects (see README)." }
