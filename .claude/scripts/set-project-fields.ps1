# Set Priority + Release + Epic field values on each Project item.
$ErrorActionPreference = 'Stop'
$gh = "C:\Users\kyler\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe"
$projectId = "PVT_kwHOAvpEDc4BYA8w"

# code -> { priority, effort, release, epic }
$cardFields = @{
    'TL-001'   = @{ priority='P0'; release='6.5'; epic='Timeline' }
    'TL-002'   = @{ priority='P0'; release='6.5'; epic='Timeline' }
    'TL-003'   = @{ priority='P0'; release='6.5'; epic='Timeline' }
    'VG-001'   = @{ priority='P0'; release='6.5'; epic='Visual Grammar' }
    'VG-002'   = @{ priority='P0'; release='6.6'; epic='Visual Grammar' }
    'VG-003'   = @{ priority='P1'; release='6.5'; epic='Visual Grammar' }
    'BR-001'   = @{ priority='P0'; release='6.6'; epic='Branches' }
    'BR-002'   = @{ priority='P2'; release='6.6'; epic='Branches' }
    'SC-001'   = @{ priority='P0'; release='6.5'; epic='Sidecar Rail' }
    'SC-002'   = @{ priority='P0'; release='6.5'; epic='Sidecar Rail' }
    'SC-003'   = @{ priority='P1'; release='6.6'; epic='Sidecar Rail' }
    'ST-001'   = @{ priority='P1'; release='6.5'; epic='Stack Detail' }
    'ST-002'   = @{ priority='P1'; release='6.6'; epic='Stack Detail' }
    'EV-001'   = @{ priority='P0'; release='6.6'; epic='Evidence' }
    'EV-002'   = @{ priority='P0'; release='6.6'; epic='Evidence' }
    'EV-003'   = @{ priority='P1'; release='6.6'; epic='Evidence' }
    'EV-004'   = @{ priority='P1'; release='6.6'; epic='Evidence' }
    'SW-001'   = @{ priority='P0'; release='6.5'; epic='Strength Weakness' }
    'SW-002'   = @{ priority='P1'; release='6.6'; epic='Strength Weakness' }
    'IX-001'   = @{ priority='P1'; release='6.6'; epic='Interaction' }
    'IX-002'   = @{ priority='P2'; release='6.7'; epic='Interaction' }
    'IX-003'   = @{ priority='P1'; release='6.7'; epic='Interaction' }
    'PR-001'   = @{ priority='P1'; release='6.7'; epic='Profile' }
    'PR-002'   = @{ priority='P2'; release='6.7'; epic='Profile' }
    'PR-003'   = @{ priority='P2'; release='6.7'; epic='Profile' }
    'PR-004'   = @{ priority='P2'; release='6.7'; epic='Profile' }
    'HOST-001' = @{ priority='P0'; release='6.8'; epic='Hosting' }
    'HOST-002' = @{ priority='P0'; release='6.8'; epic='Hosting' }
    'HOST-003' = @{ priority='P0'; release='6.8'; epic='Hosting' }
    'GAL-001'  = @{ priority='P1'; release='6.6'; epic='Gallery' }
    'GAL-002'  = @{ priority='P1'; release='6.6'; epic='Gallery' }
    'RULE-001' = @{ priority='P1'; release='6.6'; epic='Rules UX' }
    'RULE-002' = @{ priority='P1'; release='6.6'; epic='Rules UX' }
    'AN-001'   = @{ priority='P2'; release='6.7'; epic='Analytics' }
    'AN-002'   = @{ priority='P2'; release='6.8'; epic='Analytics' }
    'PM-001'   = @{ priority='P0'; release='6.5'; epic='Project Mgmt' }
    'PM-002'   = @{ priority='P1'; release='6.5'; epic='Project Mgmt' }
}

# Fetch field metadata + option IDs
$fields = & $gh project field-list 1 --owner "@me" --format json | ConvertFrom-Json
$priorityField = $fields.fields | Where-Object { $_.name -eq 'Priority' }
$releaseField  = $fields.fields | Where-Object { $_.name -eq 'Release' }
$epicField     = $fields.fields | Where-Object { $_.name -eq 'Epic' }

$priorityOptions = @{}; foreach ($o in $priorityField.options) { $priorityOptions[$o.name] = $o.id }
$releaseOptions  = @{}; foreach ($o in $releaseField.options)  { $releaseOptions[$o.name]  = $o.id }
$epicOptions     = @{}; foreach ($o in $epicField.options)     { $epicOptions[$o.name]     = $o.id }

# Fetch items
$items = & $gh project item-list 1 --owner "@me" --format json --limit 100 | ConvertFrom-Json
Write-Output "Found $($items.items.Count) items"

$ok = 0; $fail = 0
foreach ($it in $items.items) {
    $title = $it.content.title
    $code = ($title -split ' - ')[0].Trim()
    if (-not $cardFields.ContainsKey($code)) {
        Write-Output "SKIP unknown code: $title"; continue
    }
    $cf = $cardFields[$code]
    $priorityId = $priorityOptions[$cf.priority]
    $releaseId  = $releaseOptions[$cf.release]
    $epicId     = $epicOptions[$cf.epic]

    Write-Output "Setting $code -> Priority=$($cf.priority) Release=$($cf.release) Epic=$($cf.epic)"
    & $gh project item-edit --project-id $projectId --id $it.id --field-id $priorityField.id --single-select-option-id $priorityId 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $fail++; continue }
    & $gh project item-edit --project-id $projectId --id $it.id --field-id $releaseField.id  --single-select-option-id $releaseId 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $fail++; continue }
    & $gh project item-edit --project-id $projectId --id $it.id --field-id $epicField.id     --single-select-option-id $epicId 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $fail++; continue }
    $ok++
}
Write-Output "Done. ok=$ok fail=$fail"
