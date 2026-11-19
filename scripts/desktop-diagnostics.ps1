# Run only in the isolated GitHub Actions desktop, never on the user's desktop.
if ($env:GITHUB_ACTIONS -ne 'true') { exit 0 }
Get-CimInstance Win32_Process -Filter "Name = 'frostmark.exe' OR Name = 'msedgewebview2.exe'" |
    Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine |
    ConvertTo-Json -Depth 3 | Set-Content test-results/native-processes.json
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size)
    $bitmap.Save((Join-Path $PWD 'test-results/runner-desktop.png'))
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
}
