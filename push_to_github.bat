@echo off
setlocal EnableExtensions EnableDelayedExpansion

title Universal GitHub Source + Release Builder

REM ============================================================
REM
REM   UNIVERSAL GITHUB SOURCE + RELEASE BUILDER
REM
REM   ONLY CHANGE:
REM       REMOTE_URL
REM
REM   PUT THIS BAT IN ANY PROJECT ROOT.
REM
REM   SOURCE:
REM       Uses .gitignore
REM
REM   RELEASE ZIP:
REM       DOES NOT USE .gitignore
REM       ALL PROJECT FILES ARE INCLUDED
REM       EXCEPT .git DIRECTORIES
REM
REM ============================================================


REM ============================================================
REM ONLY SETTING YOU NEED TO CHANGE
REM ============================================================




REM ============================================================
REM OPTIONAL
REM ============================================================

set "BRANCH=main"

REM Leave empty to automatically use same repository.
set "RELEASE_REPO="


REM ============================================================
REM AUTO DETECT PROJECT DIRECTORY
REM ============================================================

set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

for %%A in ("%PROJECT_DIR%") do set "PROJECT_NAME=%%~nxA"
set "PROJECT_NAME=!PROJECT_NAME: =-!"

set "REMOTE_URL=https://github.com/SoumyA16-git/!PROJECT_NAME!.git"


REM ============================================================
REM DISPLAY
REM ============================================================

echo.
echo ============================================================
echo   UNIVERSAL GITHUB SOURCE + RELEASE BUILDER
echo ============================================================
echo.
echo Project:
echo   !PROJECT_NAME!
echo.
echo Project Folder:
echo   !PROJECT_DIR!
echo.
echo GitHub:
echo   !REMOTE_URL!
echo.
echo ============================================================
echo.
set /p "GITHUB_READY=Is this GitHub link ready/correct? [Y/N]: "

if /I "!GITHUB_READY!"=="Y" goto github_link_confirmed
if /I "!GITHUB_READY!"=="N" goto github_link_cancelled

echo.
echo [ERROR] Please enter Y or N.
pause
exit /b 1

:github_link_confirmed
echo.
echo [OK] GitHub link confirmed.
echo.
goto github_link_continue

:github_link_cancelled
echo.
echo [CANCELLED] GitHub link was not confirmed.
echo Script stopped.
pause
exit /b 0

:github_link_continue


REM ============================================================
REM 1. CHECK PROJECT
REM ============================================================

echo [1/10] Checking project...

if not exist "!PROJECT_DIR!\" (
    echo.
    echo [ERROR] Project directory not found.
    goto :error
)

cd /d "!PROJECT_DIR!"

if errorlevel 1 (
    echo.
    echo [ERROR] Could not enter project directory.
    goto :error
)

echo [OK] Project detected.


REM ============================================================
REM 2. CHECK TOOLS
REM ============================================================

echo.
echo [2/10] Checking required tools...

git --version >nul 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] Git is not installed.
    echo.
    echo Install Git and try again.
    goto :error
)

gh --version >nul 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] GitHub CLI ^(gh^) is not installed.
    echo.
    echo Install GitHub CLI and try again.
    goto :error
)

gh auth status >nul 2>&1

if errorlevel 1 (
    echo.
    echo [ERROR] GitHub CLI is not authenticated.
    echo.
    echo Run:
    echo   gh auth login
    echo.
    goto :error
)

echo [OK] Git found.
echo [OK] GitHub CLI found.
echo [OK] GitHub authentication OK.


REM ============================================================
REM 3. PREPARE GIT
REM ============================================================

echo.
echo [3/10] Preparing Git repository...

REM ------------------------------------------------------------
REM REMOVE ONLY ROOT .git
REM PROJECT FILES ARE NOT TOUCHED
REM ------------------------------------------------------------

if exist ".git\" (

    echo Existing Git repository detected.
    echo Removing existing root .git metadata...

    rmdir /s /q ".git"

    if exist ".git\" (
        echo.
        echo [ERROR] Could not remove root .git directory.
        goto :error
    )

    echo [OK] Existing Git metadata removed.
)


REM ------------------------------------------------------------
REM REMOVE NESTED .git DIRECTORIES
REM ------------------------------------------------------------

echo.
echo Searching for nested .git directories...

for /d /r "!PROJECT_DIR!" %%G in (.git) do (

    if /I not "%%~fG"=="!PROJECT_DIR!\.git" (

        echo Removing nested Git:
        echo   %%~fG

        rmdir /s /q "%%~fG" >nul 2>&1
    )
)


REM ------------------------------------------------------------
REM INITIALIZE
REM ------------------------------------------------------------

echo.
echo Initializing Git...

git init

if errorlevel 1 (
    echo [ERROR] git init failed.
    goto :error
)

git branch -M "!BRANCH!"

if errorlevel 1 (
    echo [ERROR] Could not set branch.
    goto :error
)


REM ------------------------------------------------------------
REM GIT USER
REM ------------------------------------------------------------

git config user.name "SoumyA16-git"
git config user.email "soumyaranjan.baroda@gmail.com"

echo [OK] Git repository initialized.


REM ============================================================
REM 4. CHECK .gitignore
REM ============================================================

echo.
echo [4/10] Checking .gitignore...

if exist ".gitignore" (

    echo [OK] Existing .gitignore found.
    echo [OK] Git source upload WILL respect .gitignore.

) else (

    echo [INFO] No .gitignore found.
    echo [INFO] Git will add all files.
)

echo.


REM ============================================================
REM 5. CONFIGURE GITHUB REMOTE
REM ============================================================

echo [5/10] Configuring GitHub remote...

git remote remove origin >nul 2>&1

git remote add origin "!REMOTE_URL!"

if errorlevel 1 (
    echo.
    echo [ERROR] Could not configure GitHub remote.
    goto :error
)

echo.
echo Remote:
git remote -v


REM ============================================================
REM AUTO PARSE GITHUB OWNER + REPOSITORY
REM ============================================================

echo.
echo Parsing GitHub repository...

set "GH_OWNER="
set "GH_REPO="


REM ------------------------------------------------------------
REM Remove https://github.com/
REM ------------------------------------------------------------

set "GH_URL=!REMOTE_URL:https://github.com/=!"

REM ------------------------------------------------------------
REM Remove trailing /
REM ------------------------------------------------------------

if "!GH_URL:~-1!"=="/" (
    set "GH_URL=!GH_URL:~0,-1!"
)


REM ------------------------------------------------------------
REM Extract OWNER
REM ------------------------------------------------------------

for /f "tokens=1,2 delims=/" %%A in ("!GH_URL!") do (

    set "GH_OWNER=%%A"
    set "GH_REPO=%%B"
)


REM ------------------------------------------------------------
REM Remove .git
REM ------------------------------------------------------------

if defined GH_REPO (
    set "GH_REPO=!GH_REPO:.git=!"
)


REM ------------------------------------------------------------
REM VALIDATE
REM ------------------------------------------------------------

if not defined GH_OWNER (
    echo.
    echo [ERROR] Could not detect GitHub owner.
    echo Remote:
    echo   !REMOTE_URL!
    goto :error
)

if not defined GH_REPO (
    echo.
    echo [ERROR] Could not detect GitHub repository.
    echo Remote:
    echo   !REMOTE_URL!
    goto :error
)


REM ------------------------------------------------------------
REM RELEASE REPOSITORY
REM ------------------------------------------------------------

if not defined RELEASE_REPO (
    set "RELEASE_REPO=!GH_OWNER!/!GH_REPO!"
)


echo.
echo GitHub Owner:
echo   !GH_OWNER!

echo.
echo GitHub Repository:
echo   !GH_REPO!

echo.
echo Release Repository:
echo   !RELEASE_REPO!


REM ============================================================
REM 6. GET NEXT VERSION
REM ============================================================

echo.
echo [6/10] Checking GitHub versions...
echo.
echo Repository:
echo   !GH_OWNER!/!GH_REPO!
echo.


REM ------------------------------------------------------------
REM TEST REPOSITORY
REM ------------------------------------------------------------

echo Checking GitHub repository access...

gh repo view "!GH_OWNER!/!GH_REPO!" --json nameWithOwner >nul 2>&1

if errorlevel 1 (

    echo.
    echo [ERROR] GitHub repository could not be accessed.
    echo.
    echo Repository:
    echo   !GH_OWNER!/!GH_REPO!
    echo.
    echo Check:
    echo   gh auth status
    echo.
    goto :error
)

echo [OK] GitHub repository accessible.


REM ------------------------------------------------------------
REM GET TAGS
REM ------------------------------------------------------------

echo.
echo Reading GitHub tags...

set "TAG_FILE=%TEMP%\github_tags_!RANDOM!_!RANDOM!.txt"

gh api "repos/!GH_OWNER!/!GH_REPO!/tags?per_page=100" ^
    --jq ".[].name" > "!TAG_FILE!"

if errorlevel 1 (

    echo.
    echo [ERROR] Could not read GitHub tags.
    echo.
    echo Repository:
    echo   !GH_OWNER!/!GH_REPO!
    goto :error
)


REM ------------------------------------------------------------
REM FIND HIGHEST vX.Y.Z
REM
REM IMPORTANT:
REM This uses PowerShell directly and returns ONLY one value.
REM No batch parsing of version numbers is used here.
REM ------------------------------------------------------------

set "LATEST_TAG="

for /f "usebackq delims=" %%T in (
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "$t=Get-Content -LiteralPath '!TAG_FILE!' | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^v\d+\.\d+\.\d+$' } | Sort-Object { [version]($_.Substring(1)) } -Descending | Select-Object -First 1; if($null -ne $t){Write-Output $t}"`
) do (
    set "LATEST_TAG=%%T"
)


REM ------------------------------------------------------------
REM DELETE TEMP TAG FILE
REM ------------------------------------------------------------

del /q "!TAG_FILE!" >nul 2>&1


REM ------------------------------------------------------------
REM DEBUG / RESULT
REM ------------------------------------------------------------

echo.

if defined LATEST_TAG (

    echo Latest GitHub version:
    echo   !LATEST_TAG!

) else (

    echo No semantic GitHub version found.
    echo Starting from:
    echo   v1.0.0
)


REM ============================================================
REM CALCULATE NEW VERSION
REM ============================================================

if not defined LATEST_TAG (

    set "NEW_VERSION=v1.0.0"

) else (

    set "VERSION_NUMBER=!LATEST_TAG:~1!"

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$v=[version]'!VERSION_NUMBER!'; Write-Output ('v{0}.{1}.{2}' -f $v.Major,$v.Minor,($v.Build+1))" > "%TEMP%\new_version_!RANDOM!.txt"

    set "VERSION_FILE=%TEMP%\new_version_!RANDOM!.txt"

)


REM ------------------------------------------------------------
REM ABOVE RANDOM PATH CANNOT BE REUSED.
REM USE A FIXED TEMP FILE FOR RELIABLE RESULT.
REM ------------------------------------------------------------

if defined LATEST_TAG (

    set "VERSION_FILE=%TEMP%\github_new_version.txt"

    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$v=[version]'!VERSION_NUMBER!'; Write-Output ('v{0}.{1}.{2}' -f $v.Major,$v.Minor,($v.Build+1))" > "!VERSION_FILE!"

    set "NEW_VERSION="

    for /f "usebackq delims=" %%V in ("!VERSION_FILE!") do (
        if not defined NEW_VERSION set "NEW_VERSION=%%V"
    )

    del /q "!VERSION_FILE!" >nul 2>&1
)


REM ------------------------------------------------------------
REM VALIDATE VERSION
REM ------------------------------------------------------------

if not defined NEW_VERSION (
    echo.
    echo [ERROR] Could not calculate next version.
    goto :error
)


powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$v='!NEW_VERSION!'; if($v -notmatch '^v\d+\.\d+\.\d+$'){exit 1}"

if errorlevel 1 (
    echo.
    echo [ERROR] Invalid generated version:
    echo   !NEW_VERSION!
    goto :error
)


REM ------------------------------------------------------------
REM DISPLAY VERSION
REM ------------------------------------------------------------

echo.
echo ============================================================
echo   VERSION INFORMATION
echo ============================================================
echo.
echo Repository:
echo   !GH_OWNER!/!GH_REPO!
echo.

if defined LATEST_TAG (
    echo Latest version:
    echo   !LATEST_TAG!
) else (
    echo Latest version:
    echo   NONE
)

echo.
echo New version:
echo   !NEW_VERSION!
echo.
echo ============================================================
echo.


REM ============================================================
REM 7. ADD / COMMIT / TAG
REM ============================================================

echo [7/10] Adding source files...

git add -A

if errorlevel 1 (
    echo [ERROR] git add failed.
    goto :error
)


echo.
echo Git status:
git status --short


REM ------------------------------------------------------------
REM CHECK CHANGES
REM ------------------------------------------------------------

git diff --cached --quiet

if not errorlevel 1 (

    echo.
    echo [INFO] No source changes detected.
    echo.
    echo Nothing to commit.
    echo.
    echo This usually means all files are ignored by .gitignore.
    echo.
    pause
    exit /b 0
)


REM ------------------------------------------------------------
REM COMMIT
REM ------------------------------------------------------------

echo.
echo Creating commit...

git commit -m "Release !NEW_VERSION! - !PROJECT_NAME!"

if errorlevel 1 (
    echo.
    echo [ERROR] Git commit failed.
    goto :error
)


REM ------------------------------------------------------------
REM TAG SAFETY
REM ------------------------------------------------------------

echo.
echo Checking local tag...

git rev-parse -q --verify "refs/tags/!NEW_VERSION!" >nul 2>&1

if not errorlevel 1 (

    echo.
    echo [ERROR] Local tag already exists:
    echo   !NEW_VERSION!
    echo.
    echo Version calculation problem.
    goto :error
)


REM ------------------------------------------------------------
REM CREATE TAG
REM ------------------------------------------------------------

echo.
echo Creating Git tag !NEW_VERSION!...

git tag -a "!NEW_VERSION!" -m "!PROJECT_NAME! !NEW_VERSION!"

if errorlevel 1 (
    echo.
    echo [ERROR] Git tag creation failed.
    goto :error
)

echo.
echo [OK] Git tag created:
echo   !NEW_VERSION!


REM ============================================================
REM 8. PUSH SOURCE + TAG
REM ============================================================

echo.
echo [8/10] Pushing source code to GitHub...

echo.
echo Pushing branch:
echo   !BRANCH!

git push -u origin "!BRANCH!" --force

if errorlevel 1 (
    goto :push_error
)


echo.
echo Pushing tag:
echo   !NEW_VERSION!

git push origin "!NEW_VERSION!"

if errorlevel 1 (
    goto :push_error
)

echo.
echo [OK] Source pushed.
echo [OK] Tag pushed.


REM ============================================================
REM 9. CREATE COMPLETE PROJECT ZIP
REM ============================================================

echo.
echo [9/10] Creating COMPLETE project ZIP...

echo.
echo IMPORTANT:
echo   .gitignore WILL NOT be used for ZIP.
echo.
echo ZIP WILL INCLUDE:
echo   ALL project files
echo   ALL ignored files
echo   ALL node_modules
echo   ALL build files
echo   ALL config files
echo   ALL hidden files
echo.
echo ZIP WILL EXCLUDE ONLY:
echo   .git directories
echo.


REM ------------------------------------------------------------
REM RELEASE TEMP DIRECTORY OUTSIDE PROJECT
REM ------------------------------------------------------------

set "RELEASE_DIR=%TEMP%\github_release_!PROJECT_NAME!_!RANDOM!"

if exist "!RELEASE_DIR!\" (
    rmdir /s /q "!RELEASE_DIR!"
)

mkdir "!RELEASE_DIR!"

if not exist "!RELEASE_DIR!\" (
    echo [ERROR] Could not create release directory.
    goto :error
)


REM ------------------------------------------------------------
REM FILE NAMES
REM ------------------------------------------------------------

set "ZIP_NAME=!PROJECT_NAME!-!NEW_VERSION!.zip"
set "ZIP_FILE=!RELEASE_DIR!\!ZIP_NAME!"

set "CHECKSUM_NAME=!PROJECT_NAME!-!NEW_VERSION!-SHA256.txt"
set "CHECKSUM_FILE=!RELEASE_DIR!\!CHECKSUM_NAME!"


echo.
echo ZIP:
echo   !ZIP_NAME!

echo.
echo Preparing COMPLETE project copy...


REM ============================================================
REM COPY EVERYTHING
REM
REM IMPORTANT:
REM ROBOCOPY DOES NOT READ .gitignore.
REM Therefore ignored files are copied too.
REM
REM ONLY .git directories are excluded.
REM ============================================================

robocopy "!PROJECT_DIR!" "!RELEASE_DIR!\PROJECT" /E ^
    /XD ".git" ^
    /XJ ^
    /COPY:DAT ^
    /DCOPY:DAT ^
    /R:1 ^
    /W:1 ^
    >nul

set "ROBO_RESULT=!errorlevel!"


REM ------------------------------------------------------------
REM ROBOCOPY:
REM 0-7 = SUCCESS / ACCEPTABLE
REM 8+  = FAILURE
REM ------------------------------------------------------------

if !ROBO_RESULT! GEQ 8 (

    echo.
    echo [ERROR] Could not copy complete project.
    echo Robocopy code:
    echo   !ROBO_RESULT!
    goto :error
)


echo [OK] Complete project copied.


REM ============================================================
REM CREATE ZIP
REM ============================================================

echo.
echo Creating ZIP...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$src='!RELEASE_DIR!\PROJECT';" ^
    "$dst='!ZIP_FILE!';" ^
    "Compress-Archive -Path ($src + '\*') -DestinationPath $dst -CompressionLevel Optimal -Force"

if errorlevel 1 (

    echo.
    echo [ERROR] ZIP creation failed.
    goto :error
)


if not exist "!ZIP_FILE!" (

    echo.
    echo [ERROR] ZIP file was not created.
    goto :error
)


echo.
echo [OK] COMPLETE project ZIP created.


REM ------------------------------------------------------------
REM REMOVE STAGING COPY
REM ------------------------------------------------------------

rmdir /s /q "!RELEASE_DIR!\PROJECT" >nul 2>&1


REM ============================================================
REM SHA256
REM ============================================================

echo.
echo Calculating SHA-256...

set "SHA256="

for /f "tokens=1" %%H in (
    'certutil -hashfile "!ZIP_FILE!" SHA256 ^| findstr /R /V /C:"CertUtil:" /C:"SHA256"'
) do (

    if not defined SHA256 (
        set "SHA256=%%H"
    )
)


if not defined SHA256 (

    echo.
    echo [ERROR] SHA-256 calculation failed.
    goto :error
)


REM ------------------------------------------------------------
REM CREATE CHECKSUM FILE
REM ------------------------------------------------------------

(
    echo SHA256  !ZIP_NAME!
    echo.
    echo Hash: !SHA256!
    echo Version: !NEW_VERSION!
    echo Project: !PROJECT_NAME!
    echo Repository: !REMOTE_URL!
) > "!CHECKSUM_FILE!"


echo.
echo SHA-256:
echo   !SHA256!


REM ============================================================
REM 10. CREATE GITHUB RELEASE
REM ============================================================

echo.
echo [10/10] Creating GitHub Release...

echo.
echo Release repository:
echo   !RELEASE_REPO!

echo.
echo Uploading:
echo   !ZIP_NAME!
echo   !CHECKSUM_NAME!
echo.


gh release create "!NEW_VERSION!" ^
    "!ZIP_FILE!" ^
    "!CHECKSUM_FILE!" ^
    --repo "!RELEASE_REPO!" ^
    --title "!PROJECT_NAME! !NEW_VERSION!" ^
    --notes "Automated release of !PROJECT_NAME! !NEW_VERSION!."


if errorlevel 1 (
    goto :release_error
)


REM ============================================================
REM CLEAN TEMP
REM ============================================================

rmdir /s /q "!RELEASE_DIR!" >nul 2>&1


REM ============================================================
REM SUCCESS
REM ============================================================

echo.
echo.
echo ============================================================
echo   SUCCESS - EVERYTHING COMPLETED
echo ============================================================
echo.
echo Project:
echo   !PROJECT_NAME!
echo.
echo Project Path:
echo   !PROJECT_DIR!
echo.
echo GitHub:
echo   !REMOTE_URL!
echo.
echo Repository:
echo   !GH_OWNER!/!GH_REPO!
echo.
echo Version:
echo   !NEW_VERSION!
echo.
echo.
echo SOURCE:
echo   .gitignore RESPECTED
echo.
echo RELEASE ZIP:
echo   .gitignore IGNORED
echo   ALL PROJECT FILES INCLUDED
echo   node_modules INCLUDED
echo   ignored files INCLUDED
echo   .git directories EXCLUDED
echo.
echo SHA-256:
echo   !SHA256!
echo.
echo GitHub Release:
echo   CREATED
echo.
echo ============================================================
echo.
echo DONE.
echo.
pause
exit /b 0


REM ============================================================
REM PUSH ERROR
REM ============================================================

:push_error

echo.
echo ============================================================
echo   ERROR - GITHUB PUSH FAILED
echo ============================================================
echo.
echo Project:
echo   !PROJECT_NAME!
echo.
echo Repository:
echo   !GH_OWNER!/!GH_REPO!
echo.
echo Version:
echo   !NEW_VERSION!
echo.
echo Possible reasons:
echo.
echo 1. GitHub Push Protection detected a secret.
echo 2. A file is larger than GitHub's 100 MB limit.
echo 3. Repository rules rejected the push.
echo 4. Authentication/permission problem.
echo.
echo Check:
echo   gh auth status
echo.
echo   git status
echo.
pause
exit /b 1


REM ============================================================
REM RELEASE ERROR
REM ============================================================

:release_error

echo.
echo ============================================================
echo   SOURCE PUSHED - RELEASE CREATION FAILED
echo ============================================================
echo.
echo Project:
echo   !PROJECT_NAME!
echo.
echo Version:
echo   !NEW_VERSION!
echo.
echo ZIP:
echo   !ZIP_FILE!
echo.
echo Check:
echo   gh auth status
echo.
echo You can retry manually with:
echo.
echo   gh release create "!NEW_VERSION!" "!ZIP_FILE!" "!CHECKSUM_FILE!" --repo "!RELEASE_REPO!"
echo.
pause
exit /b 1


REM ============================================================
REM GENERAL ERROR
REM ============================================================

:error

echo.
echo ============================================================
echo   ERROR - PROCESS FAILED
echo ============================================================
echo.
echo Project:
echo   !PROJECT_DIR!
echo.
echo GitHub:
echo   !GH_OWNER!/!GH_REPO!
echo.
echo Review the error above.
echo.
echo ============================================================
echo.

pause
exit /b 1