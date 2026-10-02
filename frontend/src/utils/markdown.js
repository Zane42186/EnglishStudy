/* 极简 Markdown 渲染（2026-10-02 从 review/assets/ui.js 的 renderMarkdown **逐字移植**）
 *
 * 只支持表格 / 引用 / 列表 / 段落，够渲染课程小节与阅读正文。
 *
 * ⚠️ 三个分支判定与段落终止条件必须同源（isTable/isQuote/isList），否则会出现
 *    「某行命中段落分支、却又立刻被段落终止条件挡下」→ i 不前进 → 死循环。
 *    实测触发：库内小节正文里的 `---` 分隔线、`**加粗**` 开头的行（以 - 或 * 开头
 *    但后面不是空格，不匹配列表、却被段落的 `^\s*(\||>|-|\*)` 挡下）。
 *    表现为 RangeError: Invalid array length（out 无限增长）。2026-10-01 修。
 *
 * 迁移原则：**算法一字未改**（含 while 兜底），仅把 IIFE + window 挂载改为 ESM 导出。
 */

/* HTML 转义（Vue 模板自带转义，但 markdown 走 v-html，故这里必须显式转义） */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

const RE_TABLE = /^\s*\|/;
const RE_QUOTE = /^\s*>\s?/;
const RE_LIST = /^\s*[-*]\s+/;

function isTable(l) { return RE_TABLE.test(l); }
function isQuote(l) { return RE_QUOTE.test(l); }
function isList(l) { return RE_LIST.test(l); }

export function renderMarkdown(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isTable(line)) {                              // 表格
      const rows = [];
      while (i < lines.length && isTable(lines[i])) {
        rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }));
        i += 1;
      }
      const head = rows[0] || [];
      const body = rows.slice(1).filter(function (r) {
        return !r.every(function (c) { return /^:?-{2,}:?$/.test(c); });
      });
      let html = '<table><thead><tr>' + head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('')
        + '</tr></thead><tbody>';
      body.forEach(function (r) {
        html += '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      });
      out.push(html + '</tbody></table>');
      continue;
    }
    if (isQuote(line)) {                             // 引用（中文对照等）
      const quote = [];
      while (i < lines.length && isQuote(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      out.push('<blockquote><p class="md">' + esc(quote.join('\n')) + '</p></blockquote>');
      continue;
    }
    if (isList(line)) {                              // 列表
      const items = [];
      while (i < lines.length && isList(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      out.push('<ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>');
      continue;
    }
    if (line.trim() === '') { i += 1; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() !== ''
      && !isTable(lines[i]) && !isQuote(lines[i]) && !isList(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    // 兜底：上面三个条件与分支判定已同源，理论上必然前进一格；
    // 仍强制保证 i 递增，任何正则漂移都只退化成「少合并一行」，绝不死循环。
    if (!para.length) {
      para.push(lines[i]);
      i += 1;
    }
    out.push('<p class="md">' + esc(para.join('\n')) + '</p>');
  }
  return out.join('');
}

export default renderMarkdown;
