// Each title has its own address: /movie/123, /tv/456, or /tv/456/2/5 for an episode
export const TITLE_PATH = /^\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?/

export function titlePath(type, id, episode) {
  return `/${type}/${id}` + (episode ? `/${episode.season}/${episode.episode}` : '')
}
