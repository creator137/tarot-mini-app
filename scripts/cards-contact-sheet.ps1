$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$cardRoot = Join-Path $PSScriptRoot '../public/cards'
$outputRoot = Join-Path $PSScriptRoot '../docs'
foreach ($batch in 0..3) {
  $bitmap = New-Object System.Drawing.Bitmap(1400, 1600)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::White)
  $font = New-Object System.Drawing.Font('Arial', 16)
  foreach ($offset in 0..19) {
    $index = $batch * 20 + $offset
    if ($index -gt 78) { break }
    $source = [System.Drawing.Image]::FromFile((Join-Path $cardRoot "$index.jpg"))
    $x = ($offset % 5) * 280
    $y = [math]::Floor($offset / 5) * 400
    $graphics.DrawImage($source, $x, $y + 25, 230, 370)
    $graphics.DrawString([string]$index, $font, [System.Drawing.Brushes]::Black, $x, $y)
    $source.Dispose()
  }
  $bitmap.Save((Join-Path $outputRoot "cards-contact-$batch.jpg"), [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $font.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
