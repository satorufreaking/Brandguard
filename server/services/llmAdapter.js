/**
 * BrandGuard AI - Multi-Provider Live LLM Adapter
 * Supports OpenAI, Gemini, and Anthropic with strict JSON schema validation,
 * rule verification, character offset extraction, and deterministic safe fallback.
 */

export function getLLMConfig() {
  const provider = (process.env.LLM_PROVIDER || '').trim().toLowerCase();
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!provider || provider === 'none' || provider === 'deterministic' || provider === 'disabled') {
    return {
      configured: false,
      provider: null,
      model: null,
      apiKey: null,
      apiKeyMasked: null,
      timeoutMs: 12000,
    };
  }

  let activeProvider = null;
  let activeKey = null;
  let activeModel = null;

  if (provider === 'openai' && openaiKey) {
    activeProvider = 'openai';
    activeKey = openaiKey;
    activeModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  } else if (provider === 'gemini' && geminiKey) {
    activeProvider = 'gemini';
    activeKey = geminiKey;
    activeModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  } else if (provider === 'anthropic' && anthropicKey) {
    activeProvider = 'anthropic';
    activeKey = anthropicKey;
    activeModel = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
  }

  return {
    configured: Boolean(activeProvider && activeKey),
    provider: activeProvider,
    model: activeModel,
    apiKey: activeKey,
    apiKeyMasked: activeKey ? `${activeKey.slice(0, 4)}...${activeKey.slice(-4)}` : null,
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS, 10) || 12000,
  };
}

/**
 * Builds the prompt instructing the LLM to analyze the draft text against active brand rules.
 */
function buildPrompt(draftText, activeRules = []) {
  const rulesList = activeRules.map((r) => ({
    id: r.id,
    severity: r.severity,
    category: r.category,
    rule: r.text,
    standard: r.standard || '',
  }));

  return `You are BrandGuard AI, an automated enterprise brand safety and regulatory compliance reviewer.

TASK:
Audit the provided draft text against ONLY the active brand rules listed below.
Identify all text violations.
Do not fabricate findings or rules. Every violation MUST reference a valid Rule ID from the active rules list.

ACTIVE BRAND RULES:
${JSON.stringify(rulesList, null, 2)}

DRAFT TEXT TO AUDIT:
"""
${draftText}
"""

OUTPUT FORMAT:
Respond with ONLY a raw JSON array matching this schema:
[
  {
    "ruleId": "exact rule ID (e.g. 'R-1', 'R-7', 'A-2')",
    "quoted_text": "exact substring from draft text that violates the rule",
    "explanation": "clear explanation of the violation",
    "suggested_revision": "suggested safe replacement text"
  }
]
If there are no violations, respond with: []`;
}

/**
 * Parses raw text from an LLM response into a JSON array, stripping any markdown backticks.
 */
function extractJsonArray(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  }

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('LLM output was not a JSON array');
  }
  return parsed;
}

/**
 * Executes a semantic review call to the configured LLM provider.
 * Returns { findings, rejected, used, provider, model, status, error }
 */
export async function runSemanticReview(draftText, activeRules = []) {
  const config = getLLMConfig();

  if (!config.configured) {
    return {
      findings: [],
      rejected: [],
      used: false,
      provider: null,
      model: null,
      status: 'Deterministic Mode (No LLM credentials configured)',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  const prompt = buildPrompt(draftText, activeRules);

  try {
    let rawResponseText = '';

    if (config.provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'You are BrandGuard AI compliance review engine. You always output valid, raw JSON arrays.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenAI API error (${res.status}): ${errBody.slice(0, 150)}`);
      }
      const data = await res.json();
      rawResponseText = data.choices?.[0]?.message?.content || '';

    } else if (config.provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 150)}`);
      }
      const data = await res.json();
      rawResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    } else if (config.provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Anthropic API error (${res.status}): ${errBody.slice(0, 150)}`);
      }
      const data = await res.json();
      rawResponseText = data.content?.[0]?.text || '';
    }

    clearTimeout(timeoutId);

    // Parse and validate items
    const rawItems = extractJsonArray(rawResponseText);
    const ruleMap = new Map(activeRules.map((r) => [r.id, r]));

    const findings = [];
    const rejected = [];

    for (const item of rawItems) {
      const rule = ruleMap.get(item.ruleId);
      if (!rule) {
        rejected.push({
          finding: item,
          reason: `Rejected: Rule ID "${item.ruleId}" does not exist in active brand rules`,
        });
        continue;
      }

      const quote = String(item.quoted_text || '').trim();
      if (!quote) {
        rejected.push({ finding: item, reason: 'Rejected: Missing quoted text' });
        continue;
      }

      // Check if quote is present in draft text
      const start = draftText.indexOf(quote);
      if (start === -1) {
        // Try case-insensitive search
        const lowerStart = draftText.toLowerCase().indexOf(quote.toLowerCase());
        if (lowerStart === -1) {
          rejected.push({ finding: item, reason: `Rejected: Quoted text "${quote}" not found in draft` });
          continue;
        }
      }

      const actualStart = start !== -1 ? start : draftText.toLowerCase().indexOf(quote.toLowerCase());
      const actualEnd = actualStart + quote.length;
      const actualQuote = draftText.slice(actualStart, actualEnd);

      findings.push({
        id: `f_llm_${rule.id}_${actualStart}`,
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        quoted_text: actualQuote,
        quote: actualQuote,
        start: actualStart,
        end: actualEnd,
        characterStart: actualStart,
        characterEnd: actualEnd,
        explanation: item.explanation || rule.summary || rule.text,
        message: item.explanation || rule.summary || rule.text,
        evidence_status: 'llm_semantic_analysis',
        human_review_required: true,
        suggested_revision: item.suggested_revision || '',
        status: 'active',
        source: 'llm_semantic',
      });
    }

    return {
      findings,
      rejected,
      used: true,
      provider: config.provider,
      model: config.model,
      status: `Live Semantic (${config.provider} - ${config.model})`,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn(`[BrandGuard LLM Adapter] Semantic check failed (${config.provider}):`, err.message);
    return {
      findings: [],
      rejected: [],
      used: false,
      provider: config.provider,
      model: config.model,
      error: err.message,
      status: `Deterministic Fallback (${err.name === 'AbortError' ? 'LLM timeout' : err.message})`,
    };
  }
}
