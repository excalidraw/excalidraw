export default (sentryErrorId, sceneInfo) => `
### Scene content

\`\`\`
${sceneInfo}
\`\`\`

### Sentry Error ID

${sentryErrorId}
`;
