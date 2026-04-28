---
description: Start a local web server for the Check-List app on port 8000
---

// turbo-all

1. Kill any existing process on port 8000 to avoid stale servers from other apps
```powershell
$pid8000 = (netstat -ano | findstr ":8000 " | Select-String "LISTENING" | ForEach-Object { ($_ -split "\s+")[-1] } | Select-Object -First 1); if ($pid8000) { Stop-Process -Id $pid8000 -Force -ErrorAction SilentlyContinue; Write-Host "Killed PID $pid8000 on port 8000" } else { Write-Host "Port 8000 is free" }
```

2. Start Python HTTP server from the Check-List directory on port 8000
```powershell
Set-Location "c:\Users\nbekt\OneDrive\Desktop\Sky_Guard\Check-List"; python -m http.server 8000
```
