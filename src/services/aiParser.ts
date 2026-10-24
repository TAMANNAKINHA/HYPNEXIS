// src/services/aiParser.ts

import { MissionCategory } from '../types';

interface ParsedIntent {
  name: string;
  merchant: string;
  budget: number | null;
  category: MissionCategory;
}

const MERCHANT_MAP: Record<string, { merchant: string }> = {
  // AI & SaaS
  'openai': { merchant: 'OpenAI' },
  'open ai': { merchant: 'OpenAI' },
  'gpt': { merchant: 'OpenAI' },
  'chatgpt': { merchant: 'OpenAI' },
  'anthropic': { merchant: 'Anthropic' },
  'claude': { merchant: 'Anthropic' },
  'github': { merchant: 'GitHub' },
  'git hub': { merchant: 'GitHub' },
  'subscription': { merchant: 'GitHub' },
  'cursor': { merchant: 'Cursor' },
  'notion': { merchant: 'Notion' },
  'slack': { merchant: 'Slack' },
  'figma': { merchant: 'Figma' },
  'stripe': { merchant: 'Stripe India' },

  // Cloud Infrastructure
  'aws': { merchant: 'AWS India' },
  'amazon web services': { merchant: 'AWS India' },
  'server': { merchant: 'AWS India' },
  'database': { merchant: 'AWS India' },
  'cluster': { merchant: 'AWS India' },
  'azure': { merchant: 'Azure' },
  'gcp': { merchant: 'GCP' },
  'google cloud': { merchant: 'GCP' },
  'digitalocean': { merchant: 'DigitalOcean' },
  'digital ocean': { merchant: 'DigitalOcean' },
  'vercel': { merchant: 'Vercel' },

  // Travel
  'uber': { merchant: 'Uber' },
  'airbnb': { merchant: 'Airbnb' },
  'air bnb': { merchant: 'Airbnb' },
  'makemytrip': { merchant: 'MakeMyTrip' },
  'make my trip': { merchant: 'MakeMyTrip' },
  'indigo': { merchant: 'IndiGo' },
  'flight': { merchant: 'IndiGo' },
  'book': { merchant: 'IndiGo' },
  'air india': { merchant: 'Air India' },

  // Procurement
  'amazon business': { merchant: 'Amazon Business' },
  'amazon': { merchant: 'Amazon Business' },
  'staples': { merchant: 'Staples' },
  'office depot': { merchant: 'Office Depot' },

  // Marketing
  'google ads': { merchant: 'Google Ads' },
  'meta': { merchant: 'Meta' },
  'facebook': { merchant: 'Meta' },
  'linkedin': { merchant: 'LinkedIn' },
  'canva': { merchant: 'Canva' },

  // Professional Services
  'legal': { merchant: 'Legal' },
  'consultant': { merchant: 'Consultant' },
  'ca': { merchant: 'CA' },
};

const CATEGORY_KEYWORDS: Record<MissionCategory, string[]> = {
  cloud: ['aws', 'azure', 'gcp', 'google cloud', 'server', 'deploy', 'gpu', 'instance', 'storage', 'vm', 'cloud', 'database', 'cluster', 'digitalocean', 'digital ocean', 'vercel'],
  saas: ['openai', 'open ai', 'chatgpt', 'gpt', 'anthropic', 'claude', 'github', 'cursor', 'notion', 'slack', 'figma', 'api', 'subscription', 'stripe', 'credits'],
  travel: ['flight', 'hotel', 'uber', 'airbnb', 'air bnb', 'book', 'trip', 'makemytrip', 'make my trip', 'indigo', 'air india'],
  payroll: ['salary', 'bonus', 'contractor', 'employee'],
  procurement: ['amazon', 'office', 'stationery', 'hardware', 'furniture', 'staples', 'depot'],
  marketing: ['ads', 'google ads', 'meta', 'facebook', 'linkedin', 'influencer', 'canva'],
  professional: ['legal', 'consultant', 'lawyer', 'accountant', 'audit', 'ca'],
  general: [],
};

function detectCategory(text: string): MissionCategory {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.length > 0 && keywords.some(k => lower.includes(k))) {
      return cat as MissionCategory;
    }
  }
  return 'general';
}

function extractBudget(text: string): number | null {
  // First, try to find a number immediately preceded by ₹, Rs., or rs
  const currencyMatch = text.match(/(?:₹|Rs\.?\s*|rs\.?\s*)\s*([\d,]+)/i);
  if (currencyMatch) {
    const num = parseInt(currencyMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0) return num;
  }
  // Fallback: any standalone number (but only if no currency marker was found)
  const numberMatch = text.match(/(\d{2,}(?:,\d{2,})*)/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0].replace(/,/g, ''), 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

export async function parseIntent(text: string): Promise<ParsedIntent> {
  const lower = text.toLowerCase();
  let merchant = 'Unknown Merchant';

  const sortedKeys = Object.keys(MERCHANT_MAP).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      merchant = MERCHANT_MAP[key].merchant;
      break;
    }
  }

  const userBudget = extractBudget(text);
  const category = detectCategory(text);

  return {
    name: text.trim(),
    merchant,
    budget: userBudget,
    category,
  };
}