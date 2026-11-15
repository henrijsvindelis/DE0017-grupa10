

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeText(text) {
  return String(text || '').toLowerCase().trim();
}

module.exports = { escapeRegex, normalizeText, round };
