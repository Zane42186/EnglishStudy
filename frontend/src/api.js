/* 统一 API 封装层（P0）· Vue 版（ESM）
 *
 * 由 review/assets/api.js **逐字移植**：包络解析、超时、全量分页、错误归类逻辑一字未改，
 * 仅做两处适配：① 尾部「挂 window」改为 ESM `export`；② BASE 支持 VITE_API_BASE 覆盖。
 *
 * 全站只有这一处知道后端包络长什么样：
 *   成功 { code:200, message:'success', data }
 *   失败 { code:4xx, message, data:null }（400 时 data 为 [{field,message}]）
 *   分页 data = { list, total, page, size }，size 上限 100
 * 权威契约见 backend/docs/05-api-reference.md。
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
const MAX_SIZE = 100;          // 后端 size 上限
const TIMEOUT_MS = 10000;

function ApiError(code, message, data) {
  this.name = 'ApiError';
  this.code = code;
  this.message = message;
  this.data = data == null ? null : data;
}
ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

function request(path, options) {
  const opts = options || {};
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  if (ctrl) {
    timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  }
  const init = { method: opts.method || 'GET', headers: {} };
  if (ctrl) { init.signal = ctrl.signal; }
  if (opts.body != null) {
    init.method = opts.method || 'POST';
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  return fetch(API_BASE + path, init)
    .then(function (res) {
      return res.json().catch(function () {
        throw new ApiError(0, '服务返回异常（HTTP ' + res.status + '）', null);
      });
    })
    .then(function (body) {
      if (!body || body.code !== 200) {
        let msg = (body && body.message) || '请求失败';
        if (body && body.code === 400 && Object.prototype.toString.call(body.data) === '[object Array]') {
          msg += '：' + body.data.map(function (e) {
            return (e.field || '') + ' ' + (e.message || '');
          }).join('；');
        }
        throw new ApiError(body ? body.code : 0, msg, body ? body.data : null);
      }
      return body.data;
    })
    .catch(function (err) {
      if (err instanceof ApiError) { throw err; }
      // 网络中断 / 超时 / CORS：code=0，前端据此提示「后端是否在跑」
      const offline = (err && err.name === 'AbortError');
      throw new ApiError(0, offline ? '请求超时（' + (TIMEOUT_MS / 1000) + ' 秒）' : (err && err.message) || '网络请求失败', null);
    })
    .then(function (data) {
      if (timer) { clearTimeout(timer); }
      return data;
    }, function (err) {
      if (timer) { clearTimeout(timer); }
      throw err;
    });
}

function apiGet(path) { return request(path); }

function apiPost(path, payload) { return request(path, { method: 'POST', body: payload }); }

/* 单页：返回 { list, total, page, size } */
function getPage(path, page, size) {
  const p = Math.max(1, page || 1);
  const s = Math.min(MAX_SIZE, Math.max(1, size || MAX_SIZE));
  const sep = path.indexOf('?') === -1 ? '?' : '&';
  return request(path + sep + 'page=' + p + '&size=' + s);
}

/* 全量：按分页循环取完，规避 size 上限导致的静默截断（联调报告 F2）。
 * 取到的条数必等于 total，否则视为异常抛出，绝不静默少给。 */
function getAll(path, opt) {
  const o = opt || {};
  const size = Math.min(MAX_SIZE, o.size || MAX_SIZE);
  const maxPages = o.maxPages || 20;
  let out = [];
  function step(page) {
    return getPage(path, page, size).then(function (d) {
      const list = (d && d.list) || [];
      out = out.concat(list);
      const total = d && d.total != null ? d.total : out.length;
      if (out.length < total && list.length > 0 && page < maxPages) {
        return step(page + 1);
      }
      if (out.length !== total) {
        throw new ApiError(0, '数据不完整（应取 ' + total + ' 条，实取 ' + out.length + ' 条）', null);
      }
      return { list: out, total: total };
    });
  }
  return step(1);
}

/* 距今天数：后端返回的是 'YYYY-MM-DD' 字符串，这里只做日期差，不做时区换算 */
function daysSince(dateStr) {
  if (!dateStr) { return null; }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr));
  if (!m) { return null; }
  const then = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((today - then) / 86400000);
}

/* 课程索引：优先 GET /lessons/all（含 grammarPoint，不受 size 上限静默截断）；
 * 若 /all 不可用（未部署/异常）则回退为分页拉全量，绝不给残缺列表。 */
function lessonIndex() {
  return request('/lessons/all').then(function (d) {
    const list = (d && d.list) || [];
    return { list: list, total: d && d.total != null ? d.total : list.length };
  }).catch(function () {
    return getAll('/lessons', { size: MAX_SIZE });
  });
}

export const API = {
  BASE: API_BASE,
  ApiError: ApiError,
  get: apiGet,
  post: apiPost,
  getPage: getPage,
  getAll: getAll,
  lessonIndex: lessonIndex,
  daysSince: daysSince
};
