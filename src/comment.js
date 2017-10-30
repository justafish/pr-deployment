#!/usr/bin/env node

/**
 * This script checks the current Pull Request for any previous deployment comments,
 * deletes them, and then adds a comment with a link to the new deployment URL.
 */
import fetch from 'isomorphic-fetch';

const commentPoster = ({
  prUrl = null, ghAuthTokenUsername = null, ghAuthToken = null, repoUsername = null, repoName = null, deploymentUrl = null, customMessage = 'Beep boop. Your code has been deployed!',
}) => {
  // eslint-disable-next-line max-len
  if (!prUrl || !ghAuthTokenUsername || !ghAuthToken || !repoUsername || !repoName || !deploymentUrl) {
    return Promise.reject(new Error('All required input parameters for cleanup were not provided.'));
  }

  const githubHeaders = {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-GitHub-Media-Type': 'github.v3',
      Authorization: `Basic ${Buffer.from(`${ghAuthTokenUsername}:${ghAuthToken}`).toString('base64')}`,
    },
  };

  const regex = new RegExp(`${customMessage} https://.+.now.sh/?`, 'g');
  const prNumber = prUrl.replace(`https://github.com/${repoUsername}/${repoName}/pull/`, '');

  return fetch(`https://api.github.com/repos/${repoUsername}/${repoName}/issues/${prNumber}/comments`, githubHeaders)
    .then(res => res.json())
    // Fetch all comments from this Pull Request.
    .then(response => Promise.all(response
      .map(comment => fetch(comment.url, githubHeaders)
        .then(res => res.json()))))
    // Find comments which match the pattern for posting build links,
    // and then send a DELETE request.
    .then(comments => Promise.all(comments
      .filter((comment) => {
        const match = regex.exec(comment.body);
        return (match && match.length > 0);
      })
      .map(comment => fetch(comment.url, Object.assign({}, githubHeaders, { method: 'DELETE' })))))
    // Add a new comment with the new build URL.
    .then(() => fetch(`https://api.github.com/repos/${repoUsername}/${repoName}/issues/${prNumber}/comments`, {
      ...githubHeaders,
      method: 'POST',
      body: JSON.stringify({
        body: `${customMessage} ${deploymentUrl}`,
      }),
    }));
};

export default commentPoster;
