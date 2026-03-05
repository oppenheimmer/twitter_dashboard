import type { Like } from '@/types/like'

export interface WordFrequency {
  word: string
  count: number
}

export const STOP_WORDS = new Set([
  'the', 'and', 'is', 'it', 'to', 'in', 'for', 'of', 'on', 'at', 'by',
  'with', 'from', 'as', 'or', 'an', 'be', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must', 'not', 'no',
  'nor', 'but', 'so', 'yet', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'than', 'too', 'very', 'just', 'about',
  'above', 'after', 'again', 'all', 'also', 'any', 'are', 'because',
  'before', 'between', 'come', 'down', 'during', 'even', 'every',
  'first', 'get', 'got', 'going', 'gone', 'good', 'great', 'her', 'here',
  'him', 'his', 'how', 'if', 'into', 'its', 'know', 'like', 'make',
  'man', 'many', 'me', 'much', 'my', 'new', 'now', 'off', 'only',
  'our', 'out', 'over', 'own', 'part', 'people', 'say', 'she', 'still',
  'take', 'tell', 'that', 'their', 'them', 'then', 'there', 'these',
  'they', 'thing', 'think', 'this', 'those', 'through', 'time', 'two',
  'under', 'upon', 'use', 'way', 'well', 'what', 'when', 'where',
  'which', 'while', 'who', 'why', 'you', 'your', 'one', 'see', 'don',
  'amp', 'rt', 'via', 'dead', 'link', 'really', 'right', 'want',
  'work', 'year', 'back', 'day', 'give', 'look', 'made', 'long',
  'let', 'put', 'same', 'try', 'didn', 'doesn', 'won', 'isn', 'wasn',
  // Additional low-signal words
  'things', 'something', 'anything', 'everything', 'nothing',
  'someone', 'everyone', 'always', 'never', 'maybe', 'actually',
  'pretty', 'already', 'another', 'around', 'enough', 'better',
  'thought', 'though', 'without', 'world', 'since', 'until',
  'whole', 'kind', 'keep', 'lot', 'big', 'end', 'old', 'last',
  'next', 'left', 'start', 'point', 'sure', 'run', 'set', 'high',
  'called', 'call', 'find', 'found', 'mean', 'means', 'goes', 'turn',
  // Twitter-specific
  'tweet', 'thread', 'lol', 'lmao', 'gonna', 'gotta', 'yeah',
  'yes', 'nah', 'hey', 'wow', 'omg',
])

function tokenize(text: string): string[] {
  // Strip URLs and [Dead link] markers
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/t\.co\/\S+/g, '')
    .replace(/\[Dead link\]/g, '')
    .toLowerCase()

  const rawWords = cleaned.match(/[a-z']+/g) ?? []
  return rawWords
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

export function extractWordFrequencies(
  texts: string[],
  maxWords = 100,
): WordFrequency[] {
  const counts = new Map<string, number>()

  for (const text of texts) {
    for (const word of tokenize(text)) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxWords)
}

export function findTweetsWithWord(likes: Like[], word: string): Like[] {
  const target = word.toLowerCase()
  const matches = likes.filter((like) => {
    const tokens = tokenize(like.fullText)
    return tokens.includes(target)
  })

  return matches.toSorted((a, b) => {
    const ai = BigInt(a.tweetId)
    const bi = BigInt(b.tweetId)
    return ai < bi ? 1 : ai > bi ? -1 : 0
  })
}
