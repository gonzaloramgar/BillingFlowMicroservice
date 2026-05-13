@echo off
setlocal

set "ROOT=%~dp0"

echo Iniciando discovery-server...
start "discovery-server" cmd /k "cd /d "%ROOT%discovery-server" && mvn spring-boot:run"
timeout /t 10 /nobreak >nul

echo Iniciando config-server...
start "config-server" cmd /k "cd /d "%ROOT%config-server" && mvn spring-boot:run"
timeout /t 10 /nobreak >nul

echo Iniciando security-service...
start "security-service" cmd /k "cd /d "%ROOT%security-service" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul

echo Iniciando api-gateway...
start "api-gateway" cmd /k "cd /d "%ROOT%api-gateway" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul

echo Iniciando payment-service...
start "payment-service" cmd /k "cd /d "%ROOT%payment-service" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul

echo Iniciando customer-service...
start "customer-service" cmd /k "cd /d "%ROOT%customer-service" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul
echo Todos los servicios fueron lanzados.
endlocal
