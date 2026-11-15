import { readFile, writeFile } from 'node:fs/promises';

const required = ['IG_USER_ID', 'IG_USERNAME', 'IG_ACCESS_TOKEN'];
for (const name of required) if (!process.env[name]) throw new Error('Missing required environment variable: ' + name);
const host = (process.env.META_GRAPH_HOST || 'graph.instagram.com').replace(/^https?:\/\//, '').replace(/\/$/, '');
const version = process.env.META_API_VERSION || 'v27.0';
const apiRoot = 'https://' + host + '/' + version + '/';
const username = process.env.IG_USERNAME.replace(/^@/, '').toLowerCase();
const timezone = 'Europe/Vienna';

function localDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type).value;
  return part('year') + '-' + part('month') + '-' + part('day');
}

async function request(url) {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error('Meta Graph API request failed: ' + (data.error?.message || response.statusText));
  return data;
}

async function getAllPages(url) {
  const result = [];
  let next = url;
  while (next) {
    const page = await request(next);
    result.push(...(page.data || []));
    next = page.paging?.next || null;
  }
  return result;
}

function extractTheme(caption) {
  const match = (caption || '').match(/ALLES\s+[^|\r\n]+\|\s*[^\r\n]+/i);
  return match ? match[0].trim().replace(/\s+/g, ' ') : '';
}

function parseLinkComment(text) {
  const title = text.match(/^\s*Linktext\s*:\s*(.+?)\s*$/im)?.[1]?.trim();
  const target = text.match(/^\s*URL\s*:\s*(https:\/\/\S+)\s*$/im)?.[1]?.trim();
  if (!title || !target) return null;
  let parsed;
  try { parsed = new URL(target); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  return { title, url: parsed.href };
}

const path = 'instagram-links.json';
const document = JSON.parse(await readFile(path, 'utf8'));
if (!Array.isArray(document.links)) throw new Error('instagram-links.json does not contain a links array');
const accessToken = process.env.IG_ACCESS_TOKEN;
const mediaUrl = new URL(process.env.IG_USER_ID + '/media', apiRoot);
mediaUrl.searchParams.set('fields', 'id,caption,permalink,timestamp');
mediaUrl.searchParams.set('limit', '100');
mediaUrl.searchParams.set('access_token', accessToken);
const media = await getAllPages(mediaUrl.href);
const today = localDate(Date.now());
let added = 0;
let skipped = 0;

for (const post of media) {
  if (!post.timestamp || localDate(post.timestamp) > today) continue;
  const date = localDate(post.timestamp);
  const theme = extractTheme(post.caption);
  if (!theme) { skipped++; continue; }
  const duplicate = document.links.some((entry) => Array.isArray(entry) && entry[0] === date && entry[3] === theme);
  if (duplicate) continue;
  const commentsUrl = new URL(post.id + '/comments', apiRoot);
  commentsUrl.searchParams.set('fields', 'id,text,timestamp,username');
  commentsUrl.searchParams.set('limit', '100');
  commentsUrl.searchParams.set('access_token', accessToken);
  const comments = await getAllPages(commentsUrl.href);
  const ownComment = comments.find((comment) => (comment.username || '').replace(/^@/, '').toLowerCase() === username && parseLinkComment(comment.text || ''));
  const link = ownComment && parseLinkComment(ownComment.text);
  if (!link) { skipped++; continue; }
  document.links.push([date, link.title, link.url, theme]);
  added++;
}

document.links.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
if (added > 0) {
  document.stand = today;
  await writeFile(path, JSON.stringify(document, null, 2) + '\n', 'utf8');
}
console.log('Published media checked: ' + media.length + '; new links added: ' + added + '; skipped/unlinked posts: ' + skipped + '.');
