
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$logoPath = "C:\Users\Ariel\.gemini\antigravity\brain\59086d6f-ff12-48b3-baae-0ce2dca730ce\uploaded_image_0_1768504841187.png"
$splashPath = "C:\Users\Ariel\.gemini\antigravity\brain\59086d6f-ff12-48b3-baae-0ce2dca730ce\uploaded_image_1_1768504841187.png"
$outputDir = "c:\Users\Ariel\Downloads\ARGONFIT PRO - MOBILE\resources\android"

function Resize-Image {
    param($srcPath, $width, $height, $destPath, $type)
    
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    $destImg = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($destImg)
    
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    
    if ($type -eq "icon") {
        # Logo should be ~66% of the 108dp base. 72/108 = 0.666
        $ratio = 72.0 / 108.0
        $logoWidth = $width * $ratio
        $logoHeight = $height * $ratio
        $x = ($width - $logoWidth) / 2
        $y = ($height - $logoHeight) / 2
        
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.DrawImage($srcImg, $x, $y, $logoWidth, $logoHeight)
    } elseif ($type -eq "splash") {
        # Cover logic for splash
        $srcRatio = $srcImg.Width / $srcImg.Height
        $destRatio = $width / $height
        
        if ($srcRatio -gt $destRatio) {
            $drawHeight = $height
            $drawWidth = $height * $srcRatio
            $x = ($width - $drawWidth) / 2
            $y = 0
        } else {
            $drawWidth = $width
            $drawHeight = $width / $srcRatio
            $x = 0
            $y = ($height - $drawHeight) / 2
        }
        $graphics.DrawImage($srcImg, $x, $y, $drawWidth, $drawHeight)
    }
    
    $destImg.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $destImg.Dispose()
    $srcImg.Dispose()
}

function Create-Background {
    param($width, $height, $destPath, $hexColor)
    $destImg = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($destImg)
    $color = [System.Drawing.ColorTranslator]::FromHtml($hexColor)
    $graphics.Clear($color)
    $destImg.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $destImg.Dispose()
}

# Ensure directories exist
if (!(Test-Path "$outputDir\icon")) { New-Item -ItemType Directory -Path "$outputDir\icon" -Force }
if (!(Test-Path "$outputDir\splash")) { New-Item -ItemType Directory -Path "$outputDir\splash" -Force }

# Densities for Icons
$iconDensities = @{
    "mdpi" = 108
    "hdpi" = 162
    "xhdpi" = 216
    "xxhdpi" = 324
    "xxxhdpi" = 432
}

foreach ($density in $iconDensities.Keys) {
    $size = $iconDensities[$density]
    Write-Host "Generating icon for $density ($size x $size)..."
    Resize-Image -srcPath $logoPath -width $size -height $size -destPath "$outputDir\icon\$density-foreground.png" -type "icon"
    Create-Background -width $size -height $size -destPath "$outputDir\icon\$density-background.png" -hexColor "#10B981"
}

# Densities for Splash (standard portrait sizes as per cordova-res)
$splashDensities = @{
    "mdpi" = @{w=320; h=480}
    "hdpi" = @{w=480; h=800}
    "xhdpi" = @{w=720; h=1280}
    "xxhdpi" = @{w=960; h=1600}
    "xxxhdpi" = @{w=1280; h=1920}
}

foreach ($density in $splashDensities.Keys) {
    $w = $splashDensities[$density].w
    $h = $splashDensities[$density].h
    Write-Host "Generating splash for $density ($w x $h)..."
    Resize-Image -srcPath $splashPath -width $w -height $h -destPath "$outputDir\splash\drawable-port-$density-screen.png" -type "splash"
}


# Clean up legacy files
Get-ChildItem -Path "$outputDir\icon\drawable-*-icon.png" -ErrorAction SilentlyContinue | Remove-Item
Get-ChildItem -Path "$outputDir\splash\drawable-*-screen.png" -ErrorAction SilentlyContinue | Remove-Item

# XML Generation
$xmlContent = @"
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"@

$xmlContent | Out-File -FilePath "$outputDir\icon\ic_launcher.xml" -Encoding utf8
$xmlContent | Out-File -FilePath "$outputDir\icon\ic_launcher_round.xml" -Encoding utf8

# Re-run Splash with specific naming if requested, but let's keep the standard ones for cordova-res
foreach ($density in $splashDensities.Keys) {
    $w = $splashDensities[$density].w
    $h = $splashDensities[$density].h
    Resize-Image -srcPath $splashPath -width $w -height $h -destPath "$outputDir\splash\splash-$density.png" -type "splash"
}

# Generate base images in resources/
Resize-Image -srcPath $logoPath -width 1024 -height 1024 -destPath "$outputDir\..\icon.png" -type "icon"
Resize-Image -srcPath $splashPath -width 2732 -height 2732 -destPath "$outputDir\..\splash.png" -type "splash"

Write-Host "All assets generated successfully."

