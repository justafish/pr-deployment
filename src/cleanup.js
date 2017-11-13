#!/usr/bin/env node

/**
 * This script will check the current list of deployments against open Pull Requests on GitHub.
 * If the deployment isn't linked against one, then it will shut it down.
 */
import fetch from 'isomorphic-fetch';

// Get all active now.sh deployments
const cleanup = ({
  // eslint-disable-next-line max-len
  nowToken = null, ghAuthTokenUsername = null, ghAuthToken = null, repoUsername = null, repoName = null, contextName = 'pr-deployment/deployment'
}) => {
  if (!nowToken || !ghAuthTokenUsername || !ghAuthToken || !repoUsername || !repoName) {
    return Promise.reject(new Error('All required input parameters for cleanup were not provided.'));
  }

  let deployments = null;
  let aliases = [];
  const deploymentNames = {};
  const nowShHeaders = { headers: { Authorization: `Bearer ${nowToken}` } };
  const githubHeaders = {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-GitHub-Media-Type': 'github.v3',
      Authorization: `Basic ${Buffer.from(`${ghAuthTokenUsername}:${ghAuthToken}`).toString('base64')}`,
    },
  };

  return fetch('https://api.zeit.co/now/deployments', nowShHeaders)
    .then(res => res.json())
    .then((response) => {
      aliases = response.aliases.map(alias => alias.deployment.url);
      return fetch('https://api.zeit.co/now/deployments', nowShHeaders);
    })
    .then(res => res.json())
    .then((response) => {
      deployments = response.deployments
        // Filter out containers which aren't part of the given repo.
        .filter(deployment => deployment.name === repoName)
        // Filter out containers which are still being built.
        .filter(deployment => typeof deployment.url !== 'undefined')
        // Filter out deployments which are aliased.
        .filter(deployment => !aliases.includes(deployment.url));
      // Save into a variable by ID so we can use it as a reference later.
      deployments.forEach((deployment) => {
        deploymentNames[deployment.uid] = deployment;
      });

      return fetch(`https://api.github.com/repos/${repoUsername}/${repoName}/pulls?state=open`, githubHeaders);
    })
    .then(response => response.json())
    .then(pullRequests => Promise.all(pullRequests
    // eslint-disable-next-line no-underscore-dangle
      .map(pullRequest => fetch(pullRequest._links.statuses.href, githubHeaders)
        .then(response => response.json()))))
    .then((pullRequestStatuses) => {
      let allStatuses = [];
      pullRequestStatuses.forEach((statuses) => {
        allStatuses = allStatuses.concat(statuses);
      });

      allStatuses = allStatuses
        // Get only statuses which are for ci/deploy
        .filter(status => status.context === contextName)
        // Retrieve only the deployed URL
        .map(status => status.target_url)
        // Make sure this is a now.sh URL
        .filter(url => url.substr(-7) === '.now.sh')
        // Remove https://
        .map(url => url.substr(8));

      return Promise.all(deployments
      // Make sure this deployment isn't being used in an active pull request.
        .filter(deployment => allStatuses.indexOf(deployment.url) === -1)
        .map(deployment => fetch(`https://api.zeit.co/now/deployments/${deployment.uid}`, { ...nowShHeaders, method: 'DELETE' })
          .then(response => response.json())));
    })
    .then(responses => responses.map(response => ({
      ...response,
      url: deploymentNames[response.uid].url,
    })));
};

export default cleanup;
