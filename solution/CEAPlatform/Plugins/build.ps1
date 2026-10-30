# Builds CEAPlatform.Plugins.dll with the .NET Framework C# compiler (no .NET SDK required).
# Downloads Microsoft.Xrm.Sdk once into tools\.cache\sdk and signs with a generated key (not committed).
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."
$cache = Join-Path $root 'tools\.cache\sdk'
$out = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Force $cache, $out | Out-Null

if (-not (Test-Path "$cache\Microsoft.Xrm.Sdk.dll")) {
    Invoke-WebRequest 'https://www.nuget.org/api/v2/package/Microsoft.CrmSdk.CoreAssemblies/9.0.2.56' -OutFile "$cache\sdk.zip"
    Expand-Archive "$cache\sdk.zip" "$cache\pkg" -Force
    Copy-Item "$cache\pkg\lib\net462\Microsoft.Xrm.Sdk.dll" $cache
}
if (-not (Test-Path "$cache\Microsoft.Crm.Sdk.Proxy.dll")) {
    if (-not (Test-Path "$cache\pkg")) { Invoke-WebRequest 'https://www.nuget.org/api/v2/package/Microsoft.CrmSdk.CoreAssemblies/9.0.2.56' -OutFile "$cache\sdk.zip"; Expand-Archive "$cache\sdk.zip" "$cache\pkg" -Force }
    Copy-Item "$cache\pkg\lib\net462\Microsoft.Crm.Sdk.Proxy.dll" $cache
}
$snk = Join-Path $cache 'CEAPlatform.snk'
if (-not (Test-Path $snk)) {
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider(2048)
    $blob = $rsa.ExportCspBlob($true)
    $blob[4] = 0x00; $blob[5] = 0x24; $blob[6] = 0; $blob[7] = 0   # CALG_RSA_SIGN, required for strong-name keys
    [IO.File]::WriteAllBytes($snk, $blob)
}
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:library /optimize+ /out:"$out\CEAPlatform.Plugins.dll" /keyfile:$snk `
    /reference:"$cache\Microsoft.Xrm.Sdk.dll" /reference:"$cache\Microsoft.Crm.Sdk.Proxy.dll" /reference:System.Runtime.Serialization.dll `
    (Get-ChildItem $PSScriptRoot -Filter *.cs | ForEach-Object FullName)
if ($LASTEXITCODE -ne 0) { throw 'compile failed' }
"Built $out\CEAPlatform.Plugins.dll"
