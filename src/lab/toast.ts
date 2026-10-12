let timer = 0;

/** Short message over the range. kind 'alert' is used for overloads. */
export function toast(text: string, kind: 'info' | 'alert' = 'info', ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.className = `show ${kind}`;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => (el.className = ''), ms);
}
