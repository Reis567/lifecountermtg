<#
.SYNOPSIS
  Deploy do LifeCounter: site (web) + backend (API) + APK, tudo pra VPS lifecounter.mreis.site.

.DESCRIPTION
  Independe do git: empacota o que está no disco e manda via pscp/plink (PuTTY, senha).
    .\deploy.ps1                      # build web + envia site e backend, migrate, restart
    .\deploy.ps1 -Apk                 # + builda o APK (gradle), envia e registra a versão no servidor
    .\deploy.ps1 -Apk -Changelog "..."
    .\deploy.ps1 -Setup               # primeira vez: roda deploy/setup_server.sh no servidor (venv, nginx, certbot)
  A versão do APK vem de android/app/build.gradle.kts (versionCode/versionName) — mantenha igual
  a src/ts/updater.ts (APP_VERSION_CODE/NAME).
#>
param(
    [switch]$Apk,
    [switch]$Setup,
    [switch]$SkipBuild,
    [string]$Changelog = ""
)
$ErrorActionPreference = 'Stop'

$Server = 'root@134.209.45.112'
# Senha do servidor fica FORA do git: deploy.local.ps1 (gitignored) define $Pw,
# ou use a variável de ambiente LC_DEPLOY_PW.
$Pw = $env:LC_DEPLOY_PW
$localCfg = Join-Path $PSScriptRoot 'deploy.local.ps1'
if (Test-Path $localCfg) { . $localCfg }
if (-not $Pw) { throw 'Senha do servidor não encontrada: crie deploy.local.ps1 com $Pw = "..." (ou defina LC_DEPLOY_PW).' }
$Plink = 'C:\Program Files\PuTTY\plink.exe'
$Pscp = 'C:\Program Files\PuTTY\pscp.exe'
$Root = $PSScriptRoot
$Remote = '/root/lifecounter'
$Tar = 'C:\Windows\System32\tar.exe'

function Remote([string]$cmd) {
    & $Plink -batch -pw $Pw $Server $cmd
    if ($LASTEXITCODE -ne 0) { throw "falhou no servidor: $cmd" }
}
function Upload([string]$local, [string]$remotePath) {
    & $Pscp -batch -pw $Pw $local "${Server}:$remotePath"
    if ($LASTEXITCODE -ne 0) { throw "upload falhou: $local" }
}

# ---- 1. build web (tsc + bundle android) ----
if (-not $SkipBuild) {
    Write-Host "[1/5] build (tsc + bundle)" -ForegroundColor Cyan
    Push-Location $Root
    npm run build:android
    if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'build falhou' }
    Pop-Location
}

# ---- 2. empacota site + backend ----
Write-Host "[2/5] empacotando" -ForegroundColor Cyan
$stage = Join-Path $env:TEMP ("lc-deploy-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force "$stage\site" | Out-Null
New-Item -ItemType Directory -Force "$stage\backend" | Out-Null

# site: só o que o navegador precisa
$siteFiles = @('index.html', 'ranking.html', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'favicon.jfif', 'config.js')
foreach ($f in $siteFiles) { if (Test-Path "$Root\$f") { Copy-Item "$Root\$f" "$stage\site\" } }
Get-ChildItem "$Root\*.mp3" | Copy-Item -Destination "$stage\site\"
New-Item -ItemType Directory -Force "$stage\site\src\js", "$stage\site\src\styles" | Out-Null
Get-ChildItem "$Root\src\js\*.js" | Copy-Item -Destination "$stage\site\src\js\"
Copy-Item "$Root\src\styles\main.css" "$stage\site\src\styles\"

# backend: código + seed (sem venv, db, media)
foreach ($d in @('config', 'core', 'seed')) {
    Copy-Item "$Root\backend\$d" "$stage\backend\$d" -Recurse
}
Get-ChildItem "$stage\backend" -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force
Copy-Item "$Root\backend\manage.py", "$Root\backend\requirements.txt" "$stage\backend\"
Copy-Item "$Root\deploy" "$stage\deploy" -Recurse

$tarPath = "$stage.tar.gz"
Push-Location $stage
& $Tar -czf $tarPath site backend deploy
Pop-Location

# ---- 3. envia e aplica ----
Write-Host "[3/5] enviando pro servidor" -ForegroundColor Cyan
Remote "mkdir -p $Remote"
Upload $tarPath "$Remote/deploy.tar.gz"
Remote "cd $Remote && rm -rf site.new && mkdir site.new && tar -xzf deploy.tar.gz -C site.new site && rm -rf site && mv site.new/site site && rmdir site.new && tar -xzf deploy.tar.gz backend deploy && rm deploy.tar.gz && chmod +x deploy/setup_server.sh"

if ($Setup) {
    Write-Host "[3b] setup inicial do servidor" -ForegroundColor Cyan
    Remote "bash $Remote/deploy/setup_server.sh"
} else {
    Write-Host "[4/5] migrate + restart" -ForegroundColor Cyan
    Remote "cd $Remote/backend && cp db.sqlite3 db.sqlite3.bak 2>/dev/null; ../venv/bin/pip install -q -r requirements.txt && ../venv/bin/python manage.py migrate --noinput && ../venv/bin/python manage.py seed_profiles && ../venv/bin/python manage.py collectstatic --noinput -v 0 && cp $Remote/deploy/lifecounter.service /etc/systemd/system/lifecounter.service && systemctl daemon-reload && systemctl restart lifecounter"
}
# Backup diário (cron) — idempotente.
Remote "chmod +x $Remote/deploy/backup.sh; (crontab -l 2>/dev/null | grep -v lifecounter/deploy/backup.sh; echo '0 4 * * * bash $Remote/deploy/backup.sh >> $Remote/backups/backup.log 2>&1') | crontab -; mkdir -p $Remote/backups"

Remove-Item $stage -Recurse -Force
Remove-Item $tarPath -Force

# ---- 5. APK ----
if ($Apk) {
    Write-Host "[5/5] APK" -ForegroundColor Cyan
    $gradle = Get-Content "$Root\android\app\build.gradle.kts" -Raw
    $code = [regex]::Match($gradle, 'versionCode\s*=\s*(\d+)').Groups[1].Value
    $name = [regex]::Match($gradle, 'versionName\s*=\s*"([^"]+)"').Groups[1].Value
    if (-not $code -or -not $name) { throw 'não achei versionCode/versionName no build.gradle.kts' }

    $apkPath = "$Root\android\app\build\outputs\apk\debug\app-debug.apk"
    if (-not $SkipBuild) {
        $gradleBin = Get-ChildItem "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.11.1-bin\*\gradle-8.11.1\bin\gradle.bat" | Select-Object -First 1
        if (-not $gradleBin) { throw 'gradle 8.11.1 não encontrado no cache (~/.gradle). Builde pelo Android Studio e rode com -SkipBuild.' }
        & $gradleBin.FullName -p "$Root\android" assembleDebug --console=plain -q
        if ($LASTEXITCODE -ne 0) { throw 'gradle falhou' }
    }
    if (-not (Test-Path $apkPath)) { throw "APK não encontrado em $apkPath" }
    $remoteApk = "apk/LifeCounter-v$name.apk"
    Upload $apkPath "$Remote/backend/media/$remoteApk"
    if (-not $Changelog) { $Changelog = "Versão $name" }
    $cl = $Changelog.Replace("'", "").Replace('"', '')
    Remote "cd $Remote/backend && ../venv/bin/python manage.py register_version $code $name $remoteApk --changelog '$cl'"
    Copy-Item $apkPath "$Root\LifeCounter-v$name.apk" -Force
    Write-Host "APK v$name ($code) publicado: https://lifecounter.mreis.site/api/update/download/" -ForegroundColor Green
}

Write-Host "Deploy OK -> https://lifecounter.mreis.site" -ForegroundColor Green
