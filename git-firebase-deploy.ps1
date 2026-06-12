param(
    [string]$Remote = "origin",
    [string]$Branch,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
    & $Action
}

function Confirm-OrStop {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt
    )

    $answer = Read-Host "$Prompt (y/N)"
    if ($answer -notin @("y", "Y", "yes", "YES")) {
        throw "Stopped by user."
    }
}

Invoke-Step -Message "Checking tools" -Action {
    git --version | Out-Null
    npx --version | Out-Null
}

Invoke-Step -Message "Git status" -Action {
    git status --short
}

Confirm-OrStop -Prompt "Continue with staging and commit"

$commitMessage = Read-Host "Enter commit message"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    throw "Commit message cannot be empty."
}

Invoke-Step -Message "Staging changes" -Action {
    git add -A
}

$hasStagedChanges = $true
& git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    $hasStagedChanges = $false
}

if ($hasStagedChanges) {
    Invoke-Step -Message "Creating commit" -Action {
        git commit -m $commitMessage
    }
} else {
    Write-Host ""
    Write-Host "No staged changes to commit. Skipping commit." -ForegroundColor Yellow
}

if ([string]::IsNullOrWhiteSpace($Branch)) {
    $Branch = (git rev-parse --abbrev-ref HEAD).Trim()
}

Invoke-Step -Message "Pushing to $Remote/$Branch" -Action {
    git push $Remote $Branch
}

if ($SkipDeploy) {
    Write-Host ""
    Write-Host "Deploy skipped by -SkipDeploy." -ForegroundColor Yellow
    exit 0
}

Confirm-OrStop -Prompt "Deploy Firebase Hosting now"

Invoke-Step -Message "Checking Firebase CLI and login" -Action {
    npx -y firebase-tools@latest --version
    npx -y firebase-tools@latest login:list
    npx -y firebase-tools@latest use
}

Invoke-Step -Message "Deploying Hosting" -Action {
    npx -y firebase-tools@latest deploy --only hosting
}

Write-Host ""
Write-Host "All done: git push + Firebase Hosting deploy completed." -ForegroundColor Green
