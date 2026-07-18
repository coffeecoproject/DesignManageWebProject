export const frontendBusinessToday = '2026-06-15';
export const frontendBusinessNow = `${frontendBusinessToday} 10:00`;

export function getNextMonthStart(value: string) {
  const [year, month] = value.slice(0, 7).split('-').map(Number);
  const nextMonth = new Date(year, month, 1);

  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
}
