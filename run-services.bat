@echo off
setlocal

set "ROOT=%~dp0"
set "CONFIG_HEALTH_URL=http://localhost:8888/security-service/default"

echo Iniciando discovery-server...
start "discovery-server" cmd /k "cd /d "%ROOT%discovery-server" && mvn spring-boot:run"
timeout /t 10 /nobreak >nul

echo Iniciando config-server...
start "config-server" cmd /k "cd /d "%ROOT%config-server" && mvn spring-boot:run"

echo Esperando a que config-server responda...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri '%CONFIG_HEALTH_URL%' -TimeoutSec 2; if($r.StatusCode -eq 200){ $ok=$true; break } } catch {}; Start-Sleep -Seconds 2 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
	echo ERROR: config-server no responde en %CONFIG_HEALTH_URL%
	exit /b 1
)

echo Iniciando security-service...
start "security-service" cmd /k "cd /d "%ROOT%security-service" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul

echo Iniciando api-gateway...
start "api-gateway" cmd /k "cd /d "%ROOT%api-gateway" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul

echo Iniciando payment-service...
start "payment-service" cmd /k "cd /d "%ROOT%payment-service" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul

echo Iniciando Webhook Listener...
start "webhook-listener" cmd /k "cd /d "%ROOT%" && "%ROOT%stripe.exe" listen --forward-to http://localhost:8081/api/payments/webhook"
timeout /t 8 /nobreak >nul

echo Iniciando customer-service...
start "customer-service" cmd /k "cd /d "%ROOT%customer-Service" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul

echo Iniciando invoice-service...
start "invoice-service" cmd /k "cd /d "%ROOT%invoice-service" && mvn spring-boot:run"
timeout /t 8 /nobreak >nul
echo Todos los servicios fueron lanzados.
endlocal