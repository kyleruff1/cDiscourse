<#
.SYNOPSIS
  Prepare a CDiscourse roadmap card for agent work: move it to the right Phase on the GitHub Project
  and print a copy-paste-ready Agent tool invocation for the next agent in the pipeline.

.DESCRIPTION
  Usage:
    .\spawn-card.ps1 TL-001                     # default: move to Design phase
    .\spawn-card.ps1 TL-001 -Phase Build        # move to Build phase
    .\spawn-card.ps1 TL-001 -Phase Review
    .\spawn-card.ps1 TL-001 -Phase Done
    .\spawn-card.ps1 TL-001 -Phase Blocked -Reason "design defect"

  The script does NOT spawn the Claude Code subagent itself. It prints the exact Agent tool
  call to paste back into your Claude Code session, which then runs the subagent with
  isolation: "worktree" so the agent works in a fresh git worktree on a feat/<code>-<slug> branch.

.NOTES
  Requires: gh CLI authenticated with project scope. Project number 1 owned by @me.
#>

param(
    [Parameter(Mandatory, Position = 0)]
    [string]$Code,

    [ValidateSet('Design', 'Build', 'Review', 'Done', 'Blocked', 'Backlog')]
    [string]$Phase = 'Design',

    [string]$Reason
)

$ErrorActionPreference = 'Stop'

$gh = "C:\Users\kyler\AppData\Local\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe"
if (-not (Test-Path $gh)) {
    $maybe = (Get-Command gh -ErrorAction SilentlyContinue).Source
    if ($maybe) { $gh = $maybe } else { throw "gh CLI not found. Install with: winget install GitHub.cli" }
}

$projectNumber = 1
$projectOwner = '@me'
$projectId = 'PVT_kwHOAvpEDc4BYA8w'

# 1. Find the issue for this code (titles look like "TL-001 - Make Timeline...")
Write-Output "Looking up issue for $Code..."
$issuesJson = & $gh issue list --search "$Code in:title" --json number,title,url,body --limit 5
$issues = $issuesJson | ConvertFrom-Json
$issue = $issues | Where-Object { $_.title -like "$Code*" } | Select-Object -First 1
if (-not $issue) {
    throw "No issue found with title matching '$Code'. Did you create the roadmap issues?"
}
Write-Output "  -> Issue #$($issue.number): $($issue.title)"
Write-Output "  -> $($issue.url)"

# 2. Find the project item for that issue
$items = & $gh project item-list $projectNumber --owner $projectOwner --format json --limit 200 | ConvertFrom-Json
$item = $items.items | Where-Object { $_.content.title -like "$Code*" } | Select-Object -First 1
if (-not $item) {
    throw "Issue '$Code' is not in Project $projectNumber. Add it manually first."
}

# 3. Get Phase field + target option id
$fields = & $gh project field-list $projectNumber --owner $projectOwner --format json | ConvertFrom-Json
$phaseField = $fields.fields | Where-Object { $_.name -eq 'Phase' }
if (-not $phaseField) { throw "Project has no 'Phase' field. Re-run setup." }
$targetOption = $phaseField.options | Where-Object { $_.name -eq $Phase }
if (-not $targetOption) { throw "Phase '$Phase' is not a valid option." }

Write-Output "Setting Phase = $Phase ..."
& $gh project item-edit --project-id $projectId --id $item.id --field-id $phaseField.id --single-select-option-id $targetOption.id | Out-Null
Write-Output "  -> OK"

# 4. Compute slug for the branch name (used by the agent prompt)
$slug = ($issue.title -replace "^$Code\s*-\s*", '' -replace "[^a-zA-Z0-9]+", '-' -replace '^-+|-+$', '').ToLower()
if ($slug.Length -gt 40) { $slug = $slug.Substring(0, 40).TrimEnd('-') }
$branchName = "feat/$Code-$slug"

# 5. Save the issue body to a temp context file the agent can reference
$contextDir = Join-Path $env:TEMP "cd-roadmap-context"
if (-not (Test-Path $contextDir)) { New-Item -ItemType Directory -Path $contextDir | Out-Null }
$contextFile = Join-Path $contextDir "$Code.md"
$issueBody = "# $($issue.title)`n`nIssue: $($issue.url)`nBranch: $branchName`n`n---`n`n$($issue.body)"
Set-Content -Path $contextFile -Value $issueBody -Encoding utf8
Write-Output "  Context saved: $contextFile"
Write-Output ""

# 6. Print the next-step Agent tool invocation
Write-Output "============================================================"
Write-Output " NEXT STEP - paste this into your Claude Code session"
Write-Output "============================================================"
Write-Output ""

switch ($Phase) {
    'Design' {
        Write-Output "Use the Agent tool with subagent_type='roadmap-designer' and isolation='worktree':"
        Write-Output ""
        Write-Output "Prompt:"
        Write-Output "  Design card $Code ($($issue.title))."
        Write-Output "  Issue: $($issue.url)"
        Write-Output "  Branch (create with this name): $branchName"
        Write-Output "  The card body is at: $contextFile"
        Write-Output ""
        Write-Output "  Read the card body, then follow the roadmap-designer agent definition:"
        Write-Output "  produce docs/designs/$Code.md, commit with message:"
        Write-Output "  'design: $Code - <title>'."
        Write-Output ""
        Write-Output "  Do NOT write production code. Do NOT push."
    }
    'Build' {
        Write-Output "Use the Agent tool with subagent_type='roadmap-implementer' (no new worktree)."
        Write-Output ""
        Write-Output "Prompt:"
        Write-Output "  Implement card $Code ($($issue.title))."
        Write-Output "  Issue: $($issue.url)"
        Write-Output "  The design doc is at: docs/designs/$Code.md"
        Write-Output "  Branch: $branchName (already exists)"
        Write-Output ""
        Write-Output "  Follow the roadmap-implementer agent definition. Phases: verify baseline,"
        Write-Output "  implement per design, test as you go, lint/typecheck before commits,"
        Write-Output "  update docs/core/current-status.md, final verification."
        Write-Output ""
        Write-Output "  Do NOT push. Do NOT deploy. Do NOT redesign."
    }
    'Review' {
        Write-Output "Use the Agent tool with subagent_type='roadmap-reviewer' (no new worktree)."
        Write-Output ""
        Write-Output "Prompt:"
        Write-Output "  Review card $Code ($($issue.title))."
        Write-Output "  Issue: $($issue.url)"
        Write-Output "  Design: docs/designs/$Code.md"
        Write-Output "  Branch: $branchName"
        Write-Output ""
        Write-Output "  Follow the roadmap-reviewer agent definition. Produce docs/reviews/$Code.md"
        Write-Output "  with verdict (Approve / Changes requested / Block) and commit it."
        Write-Output "  Do NOT modify production code. Do NOT push."
    }
    'Done' {
        Write-Output "Card marked Done. Operator next steps:"
        Write-Output "  1. Push the branch: git push -u origin $branchName"
        Write-Output "  2. Open PR:         gh pr create --title '${Code}: <title>' --body-file docs/reviews/$Code.md"
        Write-Output "  3. Run operator deploy steps from docs/designs/$Code.md if any."
        Write-Output "  4. After merge, close issue #$($issue.number) (will auto-close if PR references it)."
    }
    'Blocked' {
        Write-Output "Card marked Blocked. Reason: $Reason"
        Write-Output "Add a comment on the issue documenting the blocker:"
        Write-Output "  gh issue comment $($issue.number) --body 'Blocked: $Reason'"
    }
    'Backlog' {
        Write-Output "Card returned to Backlog. No agent action."
    }
}
Write-Output ""
Write-Output "============================================================"
