@echo off
setlocal
cd /d "%~dp0"
set "NEXO_NODE=%~dp0..\.tools\node-v22.16.0-win-x64\node.exe"
if exist "%NEXO_NODE%" goto run
set "NEXO_NODE=node"
:run
"%NEXO_NODE%" scripts\run-local.mjs dev %*
if errorlevel 1 pause
