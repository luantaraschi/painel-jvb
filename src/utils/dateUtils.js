/**
 * Utilitários de data compartilhados
 */

export const normalizeDate = (value) => {
  if (!value) return '';
  return value.includes('T') ? value.split('T')[0] : value;
};

export const parsePrazoIaDate = (prazoText, baseDate) => {
  if (!prazoText) return '';
  const match = prazoText.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (match) {
    const day = match[1];
    const month = match[2];
    const yearRaw = match[3];
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${month}-${day}`;
  }

  const relativeMatch = prazoText.match(/(\d+)\s*dias?/i);
  if (!relativeMatch) return '';
  if (!baseDate) return '';

  const normalizedBase = normalizeDate(baseDate);
  const base = new Date(normalizedBase || baseDate);
  if (Number.isNaN(base.getTime())) return '';
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + Number(relativeMatch[1]));
  return base.toISOString().split('T')[0];
};

export const getEffectiveDate = (process, returnObject = false) => {
  const baseDate = process?.data_andamento || process?.created_at;
  if (returnObject) {
    if (process?.data_prazo_final) {
      return { date: normalizeDate(process.data_prazo_final), inferred: false };
    }
    const inferred = parsePrazoIaDate(process?.prazo_ia, baseDate);
    return inferred ? { date: inferred, inferred: true } : { date: '', inferred: false };
  }
  if (process?.data_prazo_final) return normalizeDate(process.data_prazo_final);
  return parsePrazoIaDate(process?.prazo_ia, baseDate);
};

export const getDaysToDue = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
};

export const formatDateDisplay = (dateString) => {
  if (!dateString) return '-';
  try {
    const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString;
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return datePart;
  } catch {
    return dateString;
  }
};

export const getTaskDueDate = (task) => {
  const raw = task?.data_limite || task?.prazo || task?.deadline || '';
  return raw ? normalizeDate(raw) : '';
};

export const isTaskCompleted = (task) => {
  const status = (task?.status_tarefa || '').toLowerCase();
  return ['analisado', 'concluido', 'concluída', 'concluida', 'finalizado', 'finalizada', 'done'].includes(status);
};
