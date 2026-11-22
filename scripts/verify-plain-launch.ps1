# I-021 A1/A3 探针：无任何调试参数普通启动，PrintWindow 实拍窗口像素 + 输出 main.log 摘要。
# 用法: powershell -File verify-plain-launch.ps1 -ExePath <exe> -OutPng <png>
param(
  [Parameter(Mandatory = $true)][string]$ExePath,
  [Parameter(Mandatory = $true)][string]$OutPng,
  [int]$WaitSec = 10
)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32P {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

Get-Process | Where-Object { $_.Name -like '*markdown*' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Start-Process -FilePath $ExePath
Start-Sleep -Seconds $WaitSec

$proc = Get-Process | Where-Object { $_.Name -like '*markdown*' -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $proc) { Write-Output 'NO-WINDOW'; exit 1 }

$hwnd = $proc.MainWindowHandle
$rect = New-Object Win32P+RECT
[Win32P]::GetWindowRect($hwnd, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
[Win32P]::PrintWindow($hwnd, $hdc, 2) | Out-Null   # 2 = PW_RENDERFULLCONTENT
$g.ReleaseHdc($hdc)
$g.Dispose()
$bmp.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("saved " + $OutPng + " " + $w + "x" + $h)

$log = Join-Path $env:APPDATA 'markdown_editor\main.log'
if (Test-Path $log) {
  Write-Output '--- main.log tail ---'
  Get-Content $log -Tail 6
} else {
  Write-Output 'main.log MISSING'
}

Stop-Process -Name markdown_editor -Force -ErrorAction SilentlyContinue
