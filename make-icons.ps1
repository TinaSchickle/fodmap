Add-Type -AssemblyName System.Drawing
function Make($size, $path, $pad) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $red = [System.Drawing.ColorTranslator]::FromHtml('#e05a5a')
  $grn = [System.Drawing.ColorTranslator]::FromHtml('#2f9e63')
  $half = $size / 2
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $red), 0, 0, $half, $size)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $grn), $half, 0, $half, $size)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ($size * 0.07)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  $u = $size / 100.0
  $o = $pad * $u
  $s = (100 - 2 * $pad) / 100.0
  # Kreuz links
  $g.DrawLine($pen, $o + 18*$u*$s, $o + 36*$u*$s, $o + 38*$u*$s, $o + 64*$u*$s)
  $g.DrawLine($pen, $o + 38*$u*$s, $o + 36*$u*$s, $o + 18*$u*$s, $o + 64*$u*$s)
  # Haken rechts
  $pts = @(
    (New-Object System.Drawing.PointF ($o + 60*$u*$s), ($o + 52*$u*$s)),
    (New-Object System.Drawing.PointF ($o + 69*$u*$s), ($o + 64*$u*$s)),
    (New-Object System.Drawing.PointF ($o + 84*$u*$s), ($o + 36*$u*$s))
  )
  $g.DrawLines($pen, $pts)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$dir = Join-Path $PSScriptRoot 'icons'
New-Item -ItemType Directory -Force $dir | Out-Null
Make 192 (Join-Path $dir 'icon-192.png') 0
Make 512 (Join-Path $dir 'icon-512.png') 0
Make 512 (Join-Path $dir 'icon-maskable-512.png') 12
