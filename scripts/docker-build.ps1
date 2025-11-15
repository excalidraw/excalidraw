param(
    [string]$ImageName = "excalidraw:local",
    [string]$TargetPlatform = "linux/amd64",
    [string]$TargetArch = "amd64",
    [switch]$NoCache
)

# Ensure script runs from repo root (excalidraw folder)
Set-Location -Path $PSScriptRoot\..\

Write-Host "Using BuildKit and building image: $ImageName for $TargetPlatform (arch: $TargetArch)"

$env:DOCKER_BUILDKIT = "1"

$noCacheArg = if ($NoCache) { "--no-cache" } else { "" }

$cmd = "docker build $noCacheArg --build-arg TARGETPLATFORM=$TargetPlatform --build-arg TARGETARCH=$TargetArch -t $ImageName -f Dockerfile ."

Write-Host "Running: $cmd"

# Run the docker build
Invoke-Expression $cmd
