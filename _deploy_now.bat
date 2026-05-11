@echo off
cd /d "C:\Users\Mario\fairchildalchemy-app"
echo Clearing stale git lock files...
if exist ".git\index.lock" del /f ".git\index.lock"
if exist ".git\index.new.lock" del /f ".git\index.new.lock"
echo Resetting staged deletions...
git reset HEAD
echo Staging all changes...
git add -A
echo Running tests...
node --test
if %ERRORLEVEL% neq 0 (
  echo TESTS FAILED - aborting
  pause
  exit /b 1
)
echo Committing...
git commit -m "feat: rebuild catalog -- 15 premium products, local images, live Stripe links"
echo Pushing to GitHub...
git push origin main
if %ERRORLEVEL% neq 0 (
  echo PUSH FAILED
  pause
  exit /b 1
)
echo Deploying to Cloud Run...
gcloud builds submit --config=cloudbuild.yaml --project=sprime-app > deploy_latest.log 2>&1
if %ERRORLEVEL% neq 0 (
  echo DEPLOY FAILED - check deploy_latest.log
  pause
  exit /b 1
)
echo.
echo DONE - fairchildalchemy.com is live
pause
