// packages/backend/src/utils/postprocess.js
// Utility for post-processing LLM responses to remove redundant call-to-action phrases.
// To improve response quality by eliminating repetitive closing questions.
// Relevant files: rag-service.js
// Compact regex construction to avoid multiline literal issues on some runners
const CTA_PATTERNS = [
  '(?:como\\s+posso\\s+(?:ajudar|auxiliar)(?:\\s+mais)?)\\?',
  '(?:posso\\s+(?:ajudar|auxiliar)(?:\\s+em\\s+algo\\s+mais|\\s+com\\s+mais\\s+(?:alguma\\s+)?coisa)?)\\?',
  'precisa\\s+de\\s+mais\\s+informa[çc][õo]es\\??',
  'em\\s+que\\s+mais\\s+posso\\s+(?:ajudar|auxiliar)\\??',
];
const CTA_TRAILING_REGEX = new RegExp(`(\\s*[-–—]?\\s*)?(?:${CTA_PATTERNS.join('|')})\\s*$`, 'i');

export function removeRedundantClosingCTA(currentText, previousAssistantText = '') {
  if (!currentText) return currentText;
  const trimmed = String(currentText).trim();
  const prev = String(previousAssistantText || '').trim();

  const prevHadCTA = CTA_TRAILING_REGEX.test(prev);
  const currentHasCTAAtEnd = CTA_TRAILING_REGEX.test(trimmed);

  if (!currentHasCTAAtEnd) return trimmed;

  // Remove if previous also had CTA, or if the current message already contains a question earlier
  const containsQuestionElsewhere = /\?/.test(trimmed.slice(0, Math.max(0, trimmed.length - 1)));
  if (prevHadCTA || containsQuestionElsewhere) {
    return trimmed.replace(CTA_TRAILING_REGEX, '').trim();
  }
  return trimmed;
}


