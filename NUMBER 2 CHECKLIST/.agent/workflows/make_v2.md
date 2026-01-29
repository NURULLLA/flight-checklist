---
description: Create NUMBER 2 CHECKLIST and clone app (Local)
---

// turbo-all

1. Create the new directory locally and clone the project
```powershell
$dest = "./NUMBER 2 CHECKLIST"
New-Item -ItemType Directory -Force -Path $dest
Copy-Item -Path * -Destination $dest -Recurse -Force
```
