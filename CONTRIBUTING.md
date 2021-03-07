# Contributing

## Setup

### Option 1 - Manual

1. Fork and clone the repo
1. Run `npm install` to install dependencies
1. Create a branch for your PR with `git checkout -b your-branch-name`

> To keep `master` branch pointing to remote repository and make pull requests from branches on your fork. To do this, run:
>
> ```sh
> git remote add upstream https://github.com/excalidraw/excalidraw.git
> git fetch upstream
> git branch --set-upstream-to=upstream/master master
> ```

### Option 2 - CodeSandbox

1. Go to https://codesandbox.io/s/github/excalidraw/excalidraw
1. Connect your GitHub account
1. Go to Git tab on left side
1. Tap on `Fork Sandbox`
1. Write your code
1. Commit and PR automatically

## Pull Request Guidelines

Don't worry if you get any of the below wrong, or if you don't know how. We'll gladly help out.

### Title

Make sure the title starts with a semantic prefix:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Changelog

Add a brief description of your pull request to the changelog located here: [`src/packages/excalidraw/CHANGELOG.md`](src/packages/excalidraw/CHANGELOG.md)

Notes:

- Make sure to prepend to the section corresponding with the semantic prefix you selected in the title
- Link to your pull request - this will require updating the CHANGELOG _after_ creating the pull request

### Testing

Once you submit your pull request it will automatically be tested. Be sure to check the results of the test and fix any issues that arise.

It's also a good idea to consider if your change should include additional tests. This is highly recommended for new features or bug-fixes. For example, it's good practice to create a test for each bug you fix which ensures that we don't regress the code in the future.

Finally - always manually test your changes using the convenient staging environment deployed for each pull request. As much as local development attempts to replicate production, there can still be subtle differences in behavior. For larger features consider testing your change in multiple browsers as well.
