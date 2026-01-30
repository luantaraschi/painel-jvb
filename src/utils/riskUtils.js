/**
 * Utilitários de risco compartilhados
 */

export const getRiskColor = (riskLevel = '') => {
  const level = riskLevel ? riskLevel.toString().toLowerCase() : '';
  if (level.includes('alto')) return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-800';
  if (level.includes('médio') || level.includes('medio')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-200 dark:border-amber-800';
  if (level.includes('baixo')) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 border border-green-200 dark:border-green-800';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700';
};

export const normalizeText = (value) => {
  try {
    return (value || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  } catch {
    return (value || '').toString().toLowerCase();
  }
};

export const splitTerms = (value) => {
  return (value || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(normalizeText);
};

export const toggleTermInList = (currentCsv, term) => {
  const current = (currentCsv || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  const normalized = current.map(normalizeText);
  const termNorm = normalizeText(term);
  const idx = normalized.indexOf(termNorm);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(term);
  }
  return current.join(', ');
};
