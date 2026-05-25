import { gitHasCommits } from './gitRunner';
import { currentBranch, getRemoteUrl } from './githubRemote';

export type RepoStatus = {
  branch: string;
  remoteUrl: string | null;
  htmlUrl: string | null;
  hasCommits: boolean;
};

export function remoteToHtmlUrl(remoteUrl: string): string | null {
  const ssh = remoteUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (ssh) return `https://github.com/${ssh[1]}/${ssh[2]}`;
  const https = remoteUrl.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/i);
  if (https) return `https://github.com/${https[1]}/${https[2]}`;
  return null;
}

export async function getRepoStatus(cwd: string): Promise<RepoStatus> {
  const hasCommits = await gitHasCommits(cwd);
  const branch = hasCommits ? await currentBranch(cwd) : '—';
  const remoteUrl = await getRemoteUrl(cwd);
  const htmlUrl = remoteUrl ? remoteToHtmlUrl(remoteUrl) : null;
  return { branch, remoteUrl, htmlUrl, hasCommits };
}
