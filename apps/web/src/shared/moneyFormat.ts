export function formatMoney(amount: number) {
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} 元`;
}
