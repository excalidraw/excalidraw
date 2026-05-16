# Root Terraform entrypoints are split for the fixture corpus:
#   main.base.tf      — provider, locals, checks (committed)
#   main.workload.tf  — workload modules (composed from fixtures/presets/*.tfpart)
#   artifacts.tf      — deployment bucket + zip (always on)
#
# Regenerate workload: yarn fixtures:compose -- --preset 50-full
