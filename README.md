# Pull Request Deployment

This package provides functions which allow you to integrate pull request deployment into your CI
workflow. It will stand up a running environment for your code, and then pull it down when no longer
needed.

![A GitHub comment with a link to a code deployment](https://i.imgur.com/dYS29r9l.png)

Currently it supports GitHub and [Now](https://zeit.co/now) - please open an issue if you'd like
support for other integrations!

## Installation

- Includes the [Now CLI](https://github.com/zeit/now-cli) in your project.

    `npm install now --save-dev`

- Follow the [Getting Started instructions](https://zeit.co/now#get-started) and make sure you're
able to deploy your app to a running container.

- Generate a token from your [Zeit Dashboard](https://zeit.co/account/tokens) specifically for
deployments from the CI. You should be able to run `now -t <NOW_TOKEN> --public` locally to verify
it works.

- For the GitHub user you wish to comment on Pull Requests with the deployment URL, [generate an
access token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/).
They will need the repo scope.

- Create scripts that will be run by your CI on deployment. The following examples will use
[CircleCI](https://circleci.com/).

### Cleanup

The `cleanup` function will remove deployments from Now which aren't attached to any currently open
pull requests. 

```node
#!/usr/bin/env node
const prDeployment = require('pr-deployment');

prDeployment.cleanup({
  nowToken: process.env.NOW_TOKEN,
  ghAuthTokenUsername: process.env.GH_AUTH_TOKEN_USERNAME,
  ghAuthToken: process.env.GH_AUTH_TOKEN,
  repoUsername: 'Your GitHub Username',
  repoName: 'Your Repo Name',
})
  .then(cleanedUpDeployments => {
    cleanedUpDeployments.forEach(deployment => {
      console.log(`Removed stale deploy ${deployment.url}`);
    });
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
```

### Comment

The `comment` function will post a comment into the pull request with a link to the newly deployed
app on Now. It will also remove any previous comments.

```node
#!/usr/bin/env node
/**
 * This script checks the current Pull Request for any previous deployment comments,
 * deletes them, and then adds a comment with a link to the new deployment URL.
 */
const prDeployment = require('pr-deployment');

prDeployment.comment({
  prUrl: process.env.CIRCLE_PULL_REQUEST,
  ghAuthTokenUsername: process.env.GH_AUTH_TOKEN_USERNAME,
  ghAuthToken: process.env.GH_AUTH_TOKEN,
  repoUsername: 'Your GitHub Username',
  repoName: 'Your Repo Name',
  deploymentUrl: process.env.URL,
  customMessage: 'Beep boop. Your code has been deployed!'
})
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
```

### Triggering the Scripts

Add the following environment variables to your CircleCI project:

- `NOW_TOKEN` - Your Now deploy token
- `GH_AUTH_TOKEN_USERNAME` - The username for the GitHub user which will post a comment
- `GH_AUTH_TOKEN` - The authorisation token for the above user

Add the following step to your config.yml:

```
- run:
  name: now.sh deploy
  command: |
          ./.circleci/deployment-cleanup
          URL=$(./node_modules/.bin/now -t ${NOW_TOKEN} --public)
          echo $URL
          URL=${URL} ./.circleci/deployment-comment
```

![Screenshot of Now deployment in CircleCI](https://i.imgur.com/8KA4S2w.png)
