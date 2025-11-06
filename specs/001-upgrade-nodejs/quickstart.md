# Quickstart: Upgrade NodeJS to LTS v24

## Prerequisites

- NodeJS v24.x.x (latest LTS)
- npm (bundled with NodeJS v24)

## Steps

1. Install NodeJS v24 from [nodejs.org](https://nodejs.org/en/download/)
2. Verify installation:
   ```bash
   node --version
   # Should output v24.x.x
   ```
3. Update project dependencies:
   ```bash
   npm install
   ```
4. Run tests:
   ```bash
   npm test
   ```
5. Build and run the app:
   ```bash
   npm run build
   npm start
   ```
6. For Docker:
   - Ensure Dockerfile uses `FROM node:24`
   - Rebuild image: `docker build -t excalidraw-app .`

## Notes

- All contributors and CI/CD must use NodeJS v24
- Update documentation and onboarding guides to reflect new version
