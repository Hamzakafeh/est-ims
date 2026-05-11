::[Bat To Exe Converter]
::
::YAwzoRdxOk+EWAjk
::fBw5plQjdCyDJGyX8VAjFDpQQQ2MNXiuFLQI5/rH3+OEtlgPUfEDfZzPmvzfaa4a6UqE
::YAwzuBVtJxjWCl3EqQJhSA==
::ZR4luwNxJguZRRnWphJmSA==
::Yhs/ulQjdF+5
::cxAkpRVqdFKZSDk=
::cBs/ulQjdF+5
::ZR41oxFsdFKZSDk=
::eBoioBt6dFKZSDk=
::cRo6pxp7LAbNWATEpCI=
::egkzugNsPRvcWATEpCI=
::dAsiuh18IRvcCxnZtBJQ
::cRYluBh/LU+EWAnk
::YxY4rhs+aU+IeA==
::cxY6rQJ7JhzQF1fEqQJiZksaHUrTXA==
::ZQ05rAF9IBncCkqN+0xwdVsGAlXi
::ZQ05rAF9IAHYFVzEqQI5BQg0
::eg0/rx1wNQPfEVWB+kM9LVsJDA2vLws=
::fBEirQZwNQPfEVWB+kM9LVsJDA2vLws=
::cRolqwZ3JBvQF1fEqQIVGy8UZQqUOWWuCacFqMX64euAp0AYWvZ/S5bIzrGDQA==
::dhA7uBVwLU+EWHiI8VEkLQhcTRaLPSubCLwR6eS7wf+TsEQJXe0xGA==
::YQ03rBFzNR3SWATE2U4/fXs=
::dhAmsQZ3MwfNWATE11A1KQ9RSESgJSuSB7gG6ajQoaqgqkwPUeBf
::ZQ0/vhVqMQ3MEVWAtB9wSA==
::Zg8zqx1/OA3MEVWAtB9wSA==
::dhA7pRFwIByZRRnk
::Zh4grVQjdCyDJGyX8VAjFDpQQQ2MNXiuFLQI5/rHy+WEt0AYWvYsRKro7vSnLvYW5FHrZ49t5WNJjM4BMB9ZahOXZyIn52taswQ=
::YB416Ek+ZG8=
::
::
::978f952a14a936cc963da21a135fa983

@echo off

title EST Inventory System - Alestesharia Animal Nutrition
color 0B

echo.
echo  ================================================
echo   EST Inventory Management System®
echo   Alestesharia Animal Nutrition®
echo   Created By Hamza K. Ghareb™
echo  ================================================
echo.

REM Environment Variables
set APP_USERNAME=Mlo5
set APP_PASSWORD=Lara3049
set SECRET_KEY=LARALOLO

echo  [*] Starting server...
echo  [*] Browser will open automatically...
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found!
    pause
    exit /b 1
)

REM Check Flask
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo  [*] Installing Flask...
    py -m pip install flask openpyxl gunicorn
)

REM Check openpyxl
python -c "import openpyxl" >nul 2>&1
if errorlevel 1 (
    echo  [*] Installing openpyxl...
    py -m pip install openpyxl
)

cd /d "%~dp0"

start http://127.0.0.1:3049

python app.py

pause