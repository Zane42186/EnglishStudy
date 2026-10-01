/* 公共渲染层（P0）
 * 组件与四态都从这里出，页面脚本只负责「取数 → 调组件 → 塞进容器」。
 *
 * 四态约定：Loading（占位+转圈）/ Error（横幅+重试）/ Empty（暂无记录）/ 正常。
 * 缺口占位约定（Amy 约束 3）：接口没有的数据显示「—」并给 title 说明，不报错、不伪造。
 */
(function (global) {
  'use strict';

  /* ---------- 基础 ---------- */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(id) { return document.getElementById(id); }

  function setText(id, text) {
    var node = el(id);
    if (!node) { return; }
    node.textContent = text == null ? '' : text;
    node.classList.remove('pending');
  }

  /* 数据缺口：显示 — 并在 title 里说明原因 */
  function setUnknown(id, reason) {
    var node = el(id);
    if (!node) { return; }
    node.textContent = '—';
    node.classList.remove('pending');
    if (reason) { node.title = reason; }
  }

  function stateHTML(kind, text) {
    var cls = kind === 'loading' ? 'state loading' : 'state';
    return '<p class="' + cls + '">' + esc(text) + '</p>';
  }

  function setLoading(id, text) {
    var node = el(id);
    if (node) { node.innerHTML = stateHTML('loading', text || '正在加载…'); }
  }

  /* ---------- 错误横幅（局部降级：谁失败报谁，不影响其他区块） ---------- */

  var retryHandler = null;

  function showError(text) {
    var box = el('apiError');
    var msg = el('apiErrorMsg');
    if (!box || !msg) { return; }
    msg.textContent = text;
    box.classList.remove('hide');
  }

  function clearError() {
    var box = el('apiError');
    var msg = el('apiErrorMsg');
    if (box) { box.classList.add('hide'); }
    if (msg) { msg.textContent = ''; }
  }

  function onRetry(fn) {
    retryHandler = fn;
    var btn = el('apiRetry');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        if (typeof retryHandler === 'function') { retryHandler(); }
      });
    }
  }

  /* 把「某个区块失败」变成一行可读文案并挂到横幅上 */
  function partError(part, err) {
    var msg = (err && err.message) || String(err);
    if (err && err.code === 0) {
      msg += '（请确认后端服务是否在运行）';
    }
    showError(part + '加载失败：' + msg);
  }

  /* ---------- 枚举中文化 ---------- */

  var LABEL = {
    sectionType: {
      review: '复习', grammar: '今日语法', vocab_table: '词汇', examples: '例句',
      homework: '作业', my_answer: '我的作答', grading: '批改', feedback: '难度反馈',
      objectives: '本课目标', expected_mistakes: '本课易错预警', selfcheck: '提交前自查清单'
    },
    errorType: {
      grammar: '语法', spelling: '拼写', punctuation: '标点',
      word_choice: '用词', capitalization: '大小写', other: '其他'
    },
    priority: { high: '高优先', medium: '中优先', low: '低优先' },
    status: { pending: '未过关', passed: '已过关' },
    feedback: { too_easy: '太简单', just_right: '刚好', too_hard: '太难' }
  };

  function label(group, value) {
    if (value == null) { return ''; }
    var map = LABEL[group] || {};
    return map[value] || value;
  }

  /* ---------- 组件 ---------- */

  /* 连续答对进度（Amy F2：streak 0→2，2 次过关） */
  function streakBar(streak, passed) {
    var target = 2;
    var cur = Math.max(0, Math.min(target, Number(streak) || 0));
    var pct = Math.round((cur / target) * 100);
    var txt = passed ? '已过关' : ('连续答对 ' + cur + ' / ' + target);
    return '<span class="streak" title="连续答对 2 次即过关">'
      + '<span class="bar"><i class="' + (cur >= target ? 'full' : '') + '" style="width:' + pct + '%"></i></span>'
      + '<span>' + esc(txt) + '</span></span>';
  }

  function lessonCard(l) {
    var title = '第 ' + l.lessonNo + ' 课' + (l.lessonDate ? ' · ' + l.lessonDate : '');
    var searchText = [title, l.summary, l.grammarPoint, l.level].join('  ').toLowerCase();
    return '<article class="card lesson" data-text="' + esc(searchText) + '">'
      + '<h3>' + esc(title) + '</h3>'
      + '<p class="sum">' + esc(l.summary || '') + '</p>'
      + '<p class="meta">生词 ' + (l.vocabCount || 0) + ' 个 ｜ 作业 ' + (l.exerciseCount || 0)
      + ' 项 ｜ 错误 ' + (l.errorCount || 0) + ' 处</p>'
      + '<a class="btn" href="lessons/lesson.html?no=' + l.lessonNo + '">查看全文</a>'
      + '</article>';
  }

  function wordCard(w) {
    var src = w.firstLessonNo ? ('第 ' + w.firstLessonNo + ' 课首次出现') : '';
    var searchText = [w.word, w.meaning, w.example].join('  ').toLowerCase();
    return '<div class="wcard" data-text="' + esc(searchText) + '">'
      + '<div class="w">' + esc(w.word) + '</div>'
      + '<div class="p">' + esc(w.phonetic || '') + '</div>'
      + '<div class="c">' + esc(w.meaning || '') + '</div>'
      + '<div class="e">' + esc(w.example || '') + '</div>'
      + (src ? '<div class="src">' + esc(src) + '</div>' : '')
      + '</div>';
  }

  function mistakeCard(m) {
    var passed = m.status === 'passed';
    // 来源课号；无来源显示「诊断」而非「—」（口径归属 docs/ai-teacher.md 的错词复习规则一节）
    var src = m.firstLessonNo ? ('第 ' + m.firstLessonNo + ' 课') : '诊断';
    var tags = [
      '<span class="tag ' + (m.priority ? 'priority-' + m.priority : '') + '">'
      + esc(label('priority', m.priority)) + '</span>',
      '<span class="tag">' + esc(label('errorType', m.errorType)) + '</span>',
      '<span class="tag">来源 ' + esc(src) + '</span>',
      '<span class="tag' + (passed ? ' passed' : '') + '">' + esc(label('status', m.status)) + '</span>'
    ].join('');
    return '<article class="card mcard' + (passed ? ' passed-item' : '') + '"'
      + ' data-status="' + esc(m.status || '') + '"'
      + ' data-type="' + esc(m.errorType || '') + '"'
      + ' data-text="' + esc([m.wrongText, m.correctText, m.errorReason, src].join('  ').toLowerCase()) + '">'
      + '<div class="top">'
      + '<span class="wrong">' + esc(m.wrongText || '') + '</span>'
      + '<span class="arrow">→</span>'
      + '<span class="right">' + esc(m.correctText || '') + '</span>'
      + '</div>'
      + '<div class="metrics">'
      + '<span class="tag" title="累计犯错次数">第 ' + (m.wrongCount || 0) + ' 次犯</span>'
      + tags
      + '</div>'
      + '<div class="metrics">' + streakBar(m.streak, passed) + '</div>'
      + '<p class="why">' + esc(m.errorReason || '') + '</p>'
      + '</article>';
  }

  /* 错误趋势迷你图（Amy F6）：错误处数柱状 + 目标带 2—4
   * 只接受「错误处数」口径，不折算百分制（Amy 约束 1）。 */
  var TREND_BAR_H = 84;        // 柱区最大像素高
  var TREND_BAR_BOTTOM = 31;   // 柱区底部到卡片底部的距离（数字+标签占位）
  var TREND_TARGET = [2, 4];   // 目标带（出自 Amy 教学规则，前端常量，阈值校准时改这里）

  function trendChart(byLesson) {
    var list = (byLesson || []).slice();
    if (!list.length) { return stateHTML('empty', '暂无错误趋势数据'); }
    var max = TREND_TARGET[1];
    list.forEach(function (d) { if ((d.errorCount || 0) > max) { max = d.errorCount; } });
    var scale = max || 1;
    var bandBottom = TREND_BAR_BOTTOM + Math.round((TREND_TARGET[0] / scale) * TREND_BAR_H);
    var bandH = Math.round(((TREND_TARGET[1] - TREND_TARGET[0]) / scale) * TREND_BAR_H);
    var cols = list.map(function (d) {
      var n = d.errorCount || 0;
      var h = Math.max(2, Math.round((n / scale) * TREND_BAR_H));
      var cls = n > TREND_TARGET[1] ? 'bar over' : (n < TREND_TARGET[0] ? 'bar under' : 'bar');
      return '<div class="trend-col" title="第 ' + d.lessonNo + ' 课 · ' + (d.lessonDate || '')
        + '：错误 ' + n + ' 处">'
        + '<div class="num">' + n + '</div>'
        + '<div class="' + cls + '" style="height:' + h + 'px"></div>'
        + '<div class="lb">第' + d.lessonNo + '课</div></div>';
    }).join('');
    return '<div class="trend-wrap"><div class="trend">'
      + '<div class="trend-band" style="bottom:' + bandBottom + 'px;height:' + bandH + 'px">'
      + '<span>目标带 ' + TREND_TARGET[0] + '—' + TREND_TARGET[1] + '</span></div>'
      + cols
      + '</div></div>';
  }

  /* 极简 Markdown：只支持表格 / 引用 / 列表 / 段落，够渲染课程小节
   *
   * ⚠️ 三个分支判定与段落终止条件必须同源（isTable/isQuote/isList），否则会出现
   *    「某行命中段落分支、却又立刻被段落终止条件挡下」→ i 不前进 → 死循环。
   *    实测触发：库内小节正文里的 `---` 分隔线、`**加粗**` 开头的行（以 - 或 * 开头
   *    但后面不是空格，不匹配列表、却被段落的 `^\s*(\||>|-|\*)` 挡下）。
   *    表现为 RangeError: Invalid array length（out 无限增长）。2026-10-01 修。 */
  var RE_TABLE = /^\s*\|/;
  var RE_QUOTE = /^\s*>\s?/;
  var RE_LIST = /^\s*[-*]\s+/;

  function isTable(l) { return RE_TABLE.test(l); }
  function isQuote(l) { return RE_QUOTE.test(l); }
  function isList(l) { return RE_LIST.test(l); }

  function renderMarkdown(text) {
    var lines = String(text || '').split(/\r?\n/);
    var out = [];
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (isTable(line)) {                              // 表格
        var rows = [];
        while (i < lines.length && isTable(lines[i])) {
          rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); }));
          i += 1;
        }
        var head = rows[0] || [];
        var body = rows.slice(1).filter(function (r) {
          return !r.every(function (c) { return /^:?-{2,}:?$/.test(c); });
        });
        var html = '<table><thead><tr>' + head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('')
          + '</tr></thead><tbody>';
        body.forEach(function (r) {
          html += '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
        });
        out.push(html + '</tbody></table>');
        continue;
      }
      if (isQuote(line)) {                             // 引用（中文对照等）
        var quote = [];
        while (i < lines.length && isQuote(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i += 1;
        }
        out.push('<blockquote><p class="md">' + esc(quote.join('\n')) + '</p></blockquote>');
        continue;
      }
      if (isList(line)) {                              // 列表
        var items = [];
        while (i < lines.length && isList(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
          i += 1;
        }
        out.push('<ul>' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>');
        continue;
      }
      if (line.trim() === '') { i += 1; continue; }
      var para = [];
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

  function sectionBlock(s) {
    var title = label('sectionType', s.sectionType);
    return '<section class="card sec" data-type="' + esc(s.sectionType || '') + '">'
      + '<h4>' + esc(title) + '</h4>'
      + '<div class="secbody">' + renderMarkdown(s.content) + '</div>'
      + '</section>';
  }

  /* ---------- 搜索过滤（输入即过滤，命中为空显示提示） ---------- */

  function bindFilter(inputId, containerId, itemSelector, emptyText) {
    var input = el(inputId);
    var box = el(containerId);
    if (!input || !box) { return function () {}; }
    function apply() {
      var v = input.value.trim().toLowerCase();
      var items = box.querySelectorAll(itemSelector);
      var visible = 0;
      Array.prototype.forEach.call(items, function (node) {
        var hit = v === '' || String(node.dataset.text || '').indexOf(v) !== -1;
        node.classList.toggle('hide', !hit);
        if (hit) { visible += 1; }
      });
      var tip = box.querySelector('.filter-empty');
      if (visible === 0 && items.length > 0) {
        if (!tip) {
          box.insertAdjacentHTML('beforeend', '<p class="state filter-empty">' + esc(emptyText) + '</p>');
        }
      } else if (tip) {
        tip.remove();
      }
      return { visible: visible, total: items.length };
    }
    input.addEventListener('input', apply);
    return apply;
  }

  global.UI = {
    esc: esc,
    el: el,
    setText: setText,
    setUnknown: setUnknown,
    stateHTML: stateHTML,
    setLoading: setLoading,
    error: showError,
    clearError: clearError,
    onRetry: onRetry,
    partError: partError,
    label: label,
    streakBar: streakBar,
    lessonCard: lessonCard,
    wordCard: wordCard,
    mistakeCard: mistakeCard,
    trendChart: trendChart,
    renderMarkdown: renderMarkdown,
    sectionBlock: sectionBlock,
    bindFilter: bindFilter
  };
})(window);
