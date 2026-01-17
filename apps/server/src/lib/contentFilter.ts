/**
 * Content Filter Library
 *
 * Handles profanity filtering, link validation, and spam pattern detection
 * for the messaging system.
 */

// ============================================================================
// PROFANITY FILTER
// ============================================================================

// Polish profanity list (common words - extend as needed)
const POLISH_PROFANITY = [
  'kurwa', 'kurwy', 'kurwe', 'kurwo', 'kurwiszon', 'kurewski',
  'chuj', 'chuja', 'chujem', 'chuje', 'chujowy', 'chujowo',
  'pierdol', 'pierdole', 'pierdoli', 'pierdolony', 'pierdolnij', 'odpierdol',
  'jebac', 'jebany', 'jebane', 'jebani', 'pojeb', 'wyjebac', 'zajebisty', 'zjeb',
  'skurwysyn', 'skurwiel', 'suka', 'dziwka', 'kurewka',
  'dupa', 'dupek', 'dupcia', 'zadupie',
  'cipa', 'cipka', 'pizda',
  'gowno', 'gowniane', 'gowniany', 'zasrany', 'sraka',
  'pedal', 'pedaly', 'ciota',
  'debil', 'debilu', 'debile', 'kretyn', 'idiota', 'glupek',
  'szmata', 'lafirynda', 'dziwko',
];

// English profanity list (common words - extend as needed)
const ENGLISH_PROFANITY = [
  'fuck', 'fucking', 'fucked', 'fucker', 'motherfucker', 'fck', 'fuk',
  'shit', 'shitting', 'bullshit', 'shitty', 'sht',
  'ass', 'asshole', 'arse', 'arsehole',
  'bitch', 'bitches', 'btch',
  'dick', 'dickhead', 'dck',
  'cunt', 'cnt',
  'cock', 'cocks',
  'bastard', 'bastards',
  'whore', 'slut', 'hoe',
  'damn', 'damned',
  'retard', 'retarded',
  'faggot', 'fag', 'fagot',
  'nigger', 'nigga', 'negro',
  'pussy', 'puss',
  'wanker', 'twat', 'prick',
];

// Combine all profanity
const ALL_PROFANITY = [...POLISH_PROFANITY, ...ENGLISH_PROFANITY];

// Create regex pattern for each word (with word boundaries and common substitutions)
function createProfanityPattern(word: string): RegExp {
  // Replace common letter substitutions
  const pattern = word
    .replace(/a/gi, '[a@4]')
    .replace(/e/gi, '[e3]')
    .replace(/i/gi, '[i1!|]')
    .replace(/o/gi, '[o0]')
    .replace(/s/gi, '[s$5]')
    .replace(/t/gi, '[t7]')
    .replace(/u/gi, '[uv]');

  return new RegExp(`\\b${pattern}\\b`, 'gi');
}

const PROFANITY_PATTERNS = ALL_PROFANITY.map(createProfanityPattern);

/**
 * Filter profanity from text, replacing with asterisks
 */
export function filterProfanity(text: string): string {
  let filtered = text;

  for (const pattern of PROFANITY_PATTERNS) {
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  }

  return filtered;
}

/**
 * Check if text contains profanity
 */
export function containsProfanity(text: string): boolean {
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// LINK VALIDATION
// ============================================================================

// Whitelisted domains
const WHITELISTED_DOMAINS = [
  // Official game domains (add your actual domains)
  'growfortress.com',
  'arcade.com',
  // Social
  'discord.gg',
  'discord.com',
  'youtube.com',
  'youtu.be',
  'twitch.tv',
  // Common safe domains
  'twitter.com',
  'x.com',
  'reddit.com',
];

// Phishing domain patterns (domains that look like popular sites)
const PHISHING_PATTERNS = [
  // PayPal lookalikes
  /paypa[l1][\w-]*\./i,
  /pa[vy]p[a@4]l/i,
  // Steam lookalikes
  /ste[a@4]m[\w-]*\./i,
  /stea[nm][\w-]*\./i,
  /steamcornmunity/i,
  // Discord lookalikes
  /disc[o0]rd[\w-]*\./i,
  /dlscord/i,
  /dlcord/i,
  // Generic gift/free patterns
  /free[\w-]*gift/i,
  /gift[\w-]*free/i,
  // Suspicious TLDs with common names
  /\.(ru|cn|tk|ml|ga|cf|gq)$/i,
];

// Extract URLs from text
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const DOMAIN_FROM_URL = /https?:\/\/([^/\s]+)/i;

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  const match = url.match(DOMAIN_FROM_URL);
  if (match) {
    // Remove www. prefix
    return match[1].replace(/^www\./i, '').toLowerCase();
  }
  return null;
}

/**
 * Check if a domain is whitelisted
 */
function isDomainWhitelisted(domain: string): boolean {
  return WHITELISTED_DOMAINS.some(whitelisted =>
    domain === whitelisted || domain.endsWith('.' + whitelisted)
  );
}

/**
 * Check if a domain looks like phishing
 */
function isPhishingDomain(domain: string): boolean {
  for (const pattern of PHISHING_PATTERNS) {
    if (pattern.test(domain)) {
      return true;
    }
  }
  return false;
}

export interface LinkValidationResult {
  isValid: boolean;
  blockedUrls: string[];
  phishingUrls: string[];
}

/**
 * Validate links in text
 * Returns blocked URLs and whether content is valid
 */
export function validateLinks(text: string): LinkValidationResult {
  const urls = text.match(URL_REGEX) || [];
  const blockedUrls: string[] = [];
  const phishingUrls: string[] = [];

  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain) continue;

    if (isPhishingDomain(domain)) {
      phishingUrls.push(url);
    } else if (!isDomainWhitelisted(domain)) {
      blockedUrls.push(url);
    }
  }

  return {
    isValid: blockedUrls.length === 0 && phishingUrls.length === 0,
    blockedUrls,
    phishingUrls,
  };
}

/**
 * Check if text contains any URLs
 */
export function containsLinks(text: string): boolean {
  return URL_REGEX.test(text);
}

// ============================================================================
// SPAM PATTERNS
// ============================================================================

// Suspicious patterns (scam-like messages)
const SPAM_PATTERNS = [
  // Free stuff scams
  /darmow[eay]\s+gold/i,
  /free\s+gold/i,
  /free\s+gems/i,
  /free\s+coins/i,
  /za\s+darmo/i,
  // Click bait
  /kliknij\s+(tutaj|tu|link)/i,
  /click\s+here/i,
  /check\s+out\s+my/i,
  // Account/password requests
  /podaj\s+(has[lł]o|password)/i,
  /give\s+(me\s+)?(your\s+)?password/i,
  /share\s+(your\s+)?account/i,
  /konto\s+na\s+sprzeda[zż]/i,
  // Money scams
  /zarabiaj\s+online/i,
  /make\s+money\s+fast/i,
  /get\s+rich\s+quick/i,
  // Phishing attempts
  /verify\s+your\s+account/i,
  /zweryfikuj\s+konto/i,
  /potwierd[zź]\s+konto/i,
  // Spam patterns
  /(.)\1{4,}/i, // Repeated characters (aaaaaaa, !!!!!!)
];

export interface SpamCheckResult {
  isSpam: boolean;
  matchedPatterns: string[];
}

/**
 * Check if text contains spam patterns
 */
export function detectSpamPatterns(text: string): SpamCheckResult {
  const matchedPatterns: string[] = [];

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      matchedPatterns.push(pattern.source);
    }
  }

  return {
    isSpam: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

// ============================================================================
// COMBINED CONTENT VALIDATION
// ============================================================================

export interface ContentValidationResult {
  isValid: boolean;
  filteredContent: string;
  errors: string[];
  warnings: string[];
}

/**
 * Validate and filter content
 * Returns filtered content and any validation errors
 */
export function validateAndFilterContent(text: string): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for phishing links first (hard block)
  const linkValidation = validateLinks(text);
  if (linkValidation.phishingUrls.length > 0) {
    errors.push('Wiadomość zawiera podejrzane linki, które mogą być próbą oszustwa.');
    return {
      isValid: false,
      filteredContent: text,
      errors,
      warnings,
    };
  }

  // Check for blocked links
  if (linkValidation.blockedUrls.length > 0) {
    errors.push('Wiadomość zawiera linki do niedozwolonych stron. Dozwolone są tylko linki do: Discord, YouTube, Twitter, Reddit.');
    return {
      isValid: false,
      filteredContent: text,
      errors,
      warnings,
    };
  }

  // Check for spam patterns
  const spamCheck = detectSpamPatterns(text);
  if (spamCheck.isSpam) {
    warnings.push('Wiadomość zawiera treści, które mogą być uznane za spam.');
  }

  // Filter profanity
  const filteredContent = filterProfanity(text);
  if (filteredContent !== text) {
    warnings.push('Niektóre słowa zostały ocenzurowane.');
  }

  return {
    isValid: true,
    filteredContent,
    errors,
    warnings,
  };
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

export const RATE_LIMITS = {
  // Messages per hour
  MESSAGES_PER_HOUR: 30,
  // New threads per hour
  THREADS_PER_HOUR: 10,
  // Minimum seconds between messages
  MESSAGE_COOLDOWN_SECONDS: 5,
  // Flood detection: max identical messages in short time
  FLOOD_IDENTICAL_MESSAGES: 3,
  FLOOD_WINDOW_SECONDS: 60,
} as const;

/**
 * Check if account is new (less than 24 hours old)
 */
export function isNewAccount(createdAt: Date): boolean {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return createdAt > twentyFourHoursAgo;
}
