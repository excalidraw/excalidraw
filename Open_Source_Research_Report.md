# Open Source Contribution Project - Research Report

## Project Overview

**Project Name:** Excalidraw  
**Repository URL:** https://github.com/excalidraw/excalidraw  
**License:** MIT

Excalidraw is a virtual collaborative whiteboard tool designed for creating hand-drawn style diagrams. It serves as both a consumer product and a developer tool, with the core library published as an npm package (@excalidraw/excalidraw) that can be integrated into other applications. The project has significant socio-technical impact, being used by major companies including Google Cloud, Meta, CodeSandbox, Notion, and HackerRank for visual communication and diagramming needs.

## Project Metrics and Community

**Size and Age:** The project is a mature, actively maintained monorepo with over 60,000 GitHub stars, indicating strong community adoption and project viability. The repository contains multiple packages including the core Excalidraw library, utilities, math functions, and element management systems.

**Technology Stack:** Built primarily with React 19.0.0 and TypeScript 4.9.4, using modern development tools including Vite for building, Vitest for testing, and Yarn workspaces for monorepo management. The project follows strict TypeScript configuration and maintains comprehensive test coverage.

**Community Activity:** The project demonstrates active community engagement with regular commits, pull requests, and issue discussions. It maintains clear contribution guidelines accessible through their documentation site and provides multiple channels for community interaction including Discord, GitHub discussions, and issue tracking.

## Development Practices and Guidelines

**Code of Conduct:** The project follows standard open-source practices with clear contribution guidelines documented at docs.excalidraw.com/docs/introduction/contributing. Contributors are encouraged to follow established patterns and maintain code quality standards.

**Code Style:** The project enforces consistent code formatting using Prettier with custom configuration (@excalidraw/prettier-config) and ESLint for code quality. All code must pass type checking with TypeScript and maintain test coverage.

**Best Practices for Newcomers:** The project provides comprehensive documentation, development setup instructions, and maintains a "good first issue" label system. New contributors are encouraged to start with small fixes, follow the existing code patterns, and engage with the community through Discord for guidance.

## Issue Analysis

**Selected Issue:** #10044 - "Add Issue Template for Bug, Feature, and Enhancement"  
**Issue URL:** https://github.com/excalidraw/excalidraw/issues/10044  
**Opened:** October 1, 2025 by dimpal-yadav

**Issue Description:** This issue requests the addition of GitHub issue templates to improve the contribution workflow. The templates would help standardize how bugs, feature requests, and enhancements are reported, making it easier for maintainers to triage issues and for contributors to provide structured information.

**Technologies Involved:**

- GitHub issue templates (YAML format)
- Markdown for template content
- GitHub workflow configuration
- Basic understanding of project structure and contribution guidelines

**Implementation Details:** The task involves creating `.github/ISSUE_TEMPLATE/` directory with template files for:

1. Bug report template
2. Feature request template
3. Enhancement template
4. Config.yml for template selection

**Time Estimation:** 2-3 hours total, including:

- 30 minutes: Understanding existing project structure and contribution guidelines
- 1 hour: Creating and formatting the issue templates
- 30 minutes: Testing templates locally and ensuring proper formatting
- 30 minutes: Documentation and pull request creation

**Reasoning:** This issue is ideal for a first-time contributor because it:

- Provides immediate value to the project and community
- Requires minimal code changes but significant impact
- Helps the contributor understand the project's contribution workflow
- Is a well-defined task with clear deliverables
- Allows learning about GitHub's issue template system and project organization
