@echo off
chcp 65001 >nul
title Cuscuz Records Insta Kit ^| Instalador
setlocal EnableDelayedExpansion

rem ============================================================
rem  CUSCUZ RECORDS INSTA KIT - Instalador de 1 clique
rem  - Instala dependencias (npm install)
rem  - Gera os assets otimizados (npm run assets)
rem  - Inicia o servidor e abre o navegador em http://localhost:5173
rem  Basta dar duplo clique neste arquivo.
rem ============================================================

set "PORTA=5173"
set "URL=http://localhost:!PORTA!"
set "PASTA_APP=%~dp0"

echo.
echo  ==================================================
echo   CUSCUZ RECORDS ^| INSTA KIT - Bora deixar pronto!
echo  ==================================================
echo.

rem --- 1. Checa Node e npm -----------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERRO] Node.js nao encontrado!
  echo  Baixe em https://nodejs.org (versao LTS 20 ou 22 ^>^=^) e rode de novo.
  echo.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo  [ERRO] npm nao encontrado! Reinstale o Node.js LTS.
  echo.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set "NODEV=%%v"
echo  [1/4] Node !NODEV! encontrado. Beleza!

rem --- 2. Checa pasta do app ---------------------------------
if not exist "!PASTA_APP!\package.json" (
  echo  [ERRO] Nao achei "!PASTA_APP!\package.json".
  echo  Este arquivo .bat precisa ficar dentro da pasta insta-kit,
  echo  ao lado do arquivo package.json.
  echo.
  pause
  exit /b 1
)
cd /d "!PASTA_APP!"
echo  [2/4] Pasta do app: !CD!

rem --- 3. Instala dependencias --------------------------------
echo.
echo  [3/4] Instalando dependencias... ^(pode demorar uns minutinhos ^^_^^^)
echo  --------------------------------------------------
call npm install
if errorlevel 1 (
  echo.
  echo  [ERRO] Opa! O "npm install" falhou. Veja a mensagem acima.
  echo  Dica: apague a pasta insta-kit\node_modules e tente de novo.
  echo.
  pause
  exit /b 1
)
echo  --------------------------------------------------
echo  Prontinho! Dependencias instaladas.

rem --- 4. Gera assets otimizados ------------------------------
echo.
echo  [4/4] Gerando assets da marca ^(fundos, enfeites, logos...^)...
echo  --------------------------------------------------
call npm run assets
if errorlevel 1 (
  echo.
  echo  [AVISO] O passo de assets falhou, mas vou tentar subir o servidor
  echo  mesmo assim. Se faltar imagem, rode "npm run assets" manualmente.
  echo  --------------------------------------------------
) else (
  echo  --------------------------------------------------
  echo  Assets gerados com sucesso!
)

rem --- 5. Escolhe uma porta livre ------------------------------
rem  Procura a porta em uso no netstat (funciona em qualquer idioma,
rem  pois nao depende do texto do estado LISTENING/OUVINDO).
set "PORTA=5173"

:checa_porta
netstat -ano -p tcp | findstr /c:":!PORTA! " >nul 2>nul
if errorlevel 1 goto porta_livre
echo  [AVISO] A porta !PORTA! ja esta ocupada. Tentando a proxima...
set /a PORTA+=1
if !PORTA! gtr 5180 (
  echo  [ERRO] Nao achei nenhuma porta livre entre 5173 e 5180.
  echo  Feche algum programa que esteja usando essas portas e tente de novo.
  echo.
  pause
  exit /b 1
)
goto checa_porta

:porta_livre
set "URL=http://localhost:!PORTA!"

echo.
echo  ==================================================
echo   Subindo o servidor... O navegador vai abrir em:
echo   !URL!
echo.
echo   Para ENCERRAR: volte aqui e aperte CTRL+C.
echo  ==================================================
echo.

rem  O parametro --open abre o navegador sozinho na URL certa.
call npm run dev -- --port !PORTA! --strictPort --open

echo.
echo  Servidor encerrado. Valeu! ^^
pause
