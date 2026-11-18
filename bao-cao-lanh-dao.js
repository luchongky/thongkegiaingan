/* ============================================================
   IN BÁO CÁO LÃNH ĐẠO — bản gọn, trực quan (2 trang A4)
   Nút "Báo cáo lãnh đạo" tự gắn cạnh nút "In báo cáo theo bộ lọc".
   4 lựa chọn: tổng hợp · khối tỉnh · khối xã · Mục VI bão lũ.
   Phụ thuộc: state, PROGRAMS, BANDS (đã có sẵn trong index.html)
   Người lập: Lục Hồng Kỳ
   ============================================================ */
(function () {
'use strict';

var UNIT_TXT = 'triệu đồng';

var SCOPES = [
  { key: 'all',     label: 'Báo cáo tổng hợp toàn tỉnh',       note: 'Tất cả đơn vị có dự toán (khối tỉnh và khối xã)' },
  { key: 'agency',  label: 'Báo cáo khối sở, ban, ngành',      note: 'Chỉ các đơn vị cấp tỉnh' },
  { key: 'commune', label: 'Báo cáo khối xã, phường',          note: 'Chỉ các xã, phường' },
  { key: 'baolu',   label: 'Báo cáo Mục VI – Kinh phí bão lũ', note: 'Nguồn NSTW giao trong năm, theo dõi riêng' }
];

function n0(v) { return (Number(v) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }); }
function pc(a, b) { return b > 0 ? (a / b) * 100 : 0; }
function pcTxt(v) { return (Number(v) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
function esc2(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

function inScope(u, scope) {
  if (scope === 'agency') return u.kind !== 'commune';
  if (scope === 'commune') return u.kind === 'commune';
  return true;
}
function scopeText(scope) {
  if (scope === 'agency') return 'Khối sở, ban, ngành';
  if (scope === 'commune') return 'Khối xã, phường';
  return 'Toàn tỉnh';
}

/* ---------- lấy dữ liệu ---------- */
function pick(u, key) { var a = (u.p || {})[key] || [0, 0]; return { gi: Number(a[0]) || 0, gn: Number(a[1]) || 0 }; }
function pickPrev(u, key) { var a = (u.prev || {})[key] || [0, 0]; return { gi: Number(a[0]) || 0, gn: Number(a[1]) || 0 }; }

function collect(scope) {
  /* Báo cáo lãnh đạo luôn lấy TỔNG CÁC NGUỒN (I–V), không phụ thuộc bộ lọc nguồn đang xem.
     Muốn báo cáo chạy theo nguồn đang chọn thì đổi 'all' thành state.program. */
  var key = 'all';
  var prog = (PROGRAMS || []).filter(function (p) { return p.key === key; })[0];
  var rows = (state.units || [])
    .filter(function (u) { return inScope(u, scope); })
    .map(function (u) {
      var c = pick(u, key), p = pickPrev(u, key);
      return {
        name: u.name, kind: u.kind, submitted: !!u.submitted,
        gi: c.gi, gn: c.gn, con: c.gi - c.gn, tl: pc(c.gn, c.gi),
        giam: p.gn > 0 && c.gn < p.gn - 0.0001
      };
    })
    .filter(function (r) { return r.gi > 0; });
  return { key: key, progLabel: prog ? prog.label : 'Tổng các nguồn', rows: rows };
}

/* ---------- biểu đồ SVG ---------- */
function barsBySource(scope) {
  var list = (PROGRAMS || []).filter(function (p) { return p.key !== 'all'; }).map(function (p) {
    var gi = 0, gn = 0;
    (state.units || []).forEach(function (u) {
      if (!inScope(u, scope)) return;
      var c = pick(u, p.key); gi += c.gi; gn += c.gn;
    });
    return { label: p.label, gi: gi, gn: gn, tl: pc(gn, gi) };
  }).filter(function (x) { return x.gi > 0; });

  var H = 22, W = 420, LBL = 150, BW = W - LBL - 46;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + (list.length * H + 6) + '" width="100%">';
  list.forEach(function (x, i) {
    var y = i * H + 4, w = Math.max(1.5, BW * Math.min(x.tl, 100) / 100);
    var col = x.tl < 50 ? '#c0392b' : x.tl < 70 ? '#d68910' : x.tl < 90 ? '#2d7dd2' : '#1e8449';
    svg += '<text x="0" y="' + (y + 10) + '" font-size="8.2" fill="#1f2937">' + esc2(x.label) + '</text>';
    svg += '<rect x="' + LBL + '" y="' + (y + 2.5) + '" width="' + BW + '" height="10" rx="2" fill="#e8ebef"/>';
    svg += '<rect x="' + LBL + '" y="' + (y + 2.5) + '" width="' + w + '" height="10" rx="2" fill="' + col + '"/>';
    svg += '<text x="' + (LBL + BW + 4) + '" y="' + (y + 11) + '" font-size="8.2" font-weight="700" fill="' + col + '">' + pcTxt(x.tl) + '</text>';
  });
  return svg + '</svg>';
}

function barsByBand(rows) {
  var bands = (BANDS || []).map(function (b) {
    return { label: b.label, n: rows.filter(function (r) { return r.tl >= b.min && (b.max == null || r.tl < b.max); }).length };
  });
  var max = Math.max.apply(null, bands.map(function (b) { return b.n; }).concat([1]));
  var W = 300, H = 118, BASE = 92, cw = W / bands.length;
  var cols = ['#c0392b', '#d68910', '#2d7dd2', '#1e8449'];
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%">';
  bands.forEach(function (b, i) {
    var h = Math.max(2, (BASE - 16) * b.n / max), x = i * cw + cw * 0.22, w = cw * 0.56;
    svg += '<rect x="' + x + '" y="' + (BASE - h) + '" width="' + w + '" height="' + h + '" rx="2" fill="' + cols[i % 4] + '"/>';
    svg += '<text x="' + (x + w / 2) + '" y="' + (BASE - h - 3) + '" font-size="9" font-weight="700" text-anchor="middle" fill="#111">' + b.n + '</text>';
    svg += '<text x="' + (x + w / 2) + '" y="' + (BASE + 11) + '" font-size="7.6" text-anchor="middle" fill="#374151">' + esc2(b.label) + '</text>';
    svg += '<text x="' + (x + w / 2) + '" y="' + (BASE + 21) + '" font-size="7.2" text-anchor="middle" fill="#6b7280">đơn vị</text>';
  });
  svg += '<line x1="0" y1="' + BASE + '" x2="' + W + '" y2="' + BASE + '" stroke="#cbd5e1" stroke-width="0.8"/>';
  return svg + '</svg>';
}

/* ---------- bảng ---------- */
function miniTable(title, arr, cls, firstLabel, lastLabel) {
  var h = '<div class="mini"><div class="mini-h ' + cls + '">' + esc2(title) + '</div><table class="t-mini">' +
          '<tr class="hr"><td></td><td>Đơn vị</td><td class="r">' + esc2(firstLabel) + '</td><td class="r">' + esc2(lastLabel) + '</td><td class="r">Tỷ lệ</td></tr>';
  arr.forEach(function (r, i) {
    h += '<tr><td class="c">' + (i + 1) + '</td><td>' + esc2(r.name) + '</td>' +
         '<td class="r">' + n0(r.gi) + '</td><td class="r">' + n0(lastLabel === 'Còn lại' ? r.con : r.gn) + '</td>' +
         '<td class="r b">' + pcTxt(r.tl) + '</td></tr>';
  });
  return h + '</table></div>';
}

function detailHalf(arr, start) {
  var h = '<table class="t-det"><thead><tr><th>TT</th><th>Đơn vị</th><th class="r">Dự toán</th><th class="r">Giải ngân</th><th class="r">Tỷ lệ</th><th class="c">Nộp</th></tr></thead><tbody>';
  arr.forEach(function (r, i) {
    var cls = r.tl < 50 ? 'lo' : r.tl >= 90 ? 'hi' : '';
    h += '<tr><td class="c">' + (start + i) + '</td><td>' + esc2(r.name) + (r.giam ? ' <span class="warn">▼</span>' : '') + '</td>' +
         '<td class="r">' + n0(r.gi) + '</td><td class="r">' + n0(r.gn) + '</td>' +
         '<td class="r b ' + cls + '">' + pcTxt(r.tl) + '</td>' +
         '<td class="c">' + (r.submitted ? '<span class="ok">✓</span>' : '<span class="no">–</span>') + '</td></tr>';
  });
  return h + '</tbody></table>';
}

/* ---------- khung tài liệu dùng chung ---------- */
var CSS = '' +
  '@page{size:A4 portrait;margin:10mm 9mm}' +
  '*{box-sizing:border-box}' +
  'body{font:10px/1.35 "Times New Roman",Times,serif;color:#111;margin:0}' +
  '.doc{width:100%}' +
  '.hd{text-align:center;border-bottom:1.6px solid #1e3a5f;padding-bottom:5px;margin-bottom:7px}' +
  '.hd .org{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}' +
  '.hd h1{font-size:15px;margin:3px 0 2px;text-transform:uppercase;color:#1e3a5f}' +
  '.hd .sub{font-size:9.5px;color:#374151}' +
  '.kpi{display:flex;gap:5px;margin:7px 0}' +
  '.kpi>div{flex:1;border:.8px solid #d7dce3;border-radius:4px;padding:5px 6px;background:#fafbfc}' +
  '.kpi .k{font-size:7.6px;text-transform:uppercase;letter-spacing:.3px;color:#6b7280}' +
  '.kpi .v{font-size:14px;font-weight:700;color:#1e3a5f;line-height:1.15}' +
  '.kpi .n{font-size:7.4px;color:#6b7280}' +
  '.kpi .big{color:#1e8449}' +
  '.row{display:flex;gap:8px;margin-top:6px}' +
  '.box{border:.8px solid #d7dce3;border-radius:4px;padding:5px 7px}' +
  '.box>.t{font-size:8.6px;font-weight:700;text-transform:uppercase;color:#1e3a5f;margin-bottom:4px;letter-spacing:.3px}' +
  '.mini{flex:1}' +
  '.mini-h{font-size:8.4px;font-weight:700;padding:3px 5px;border-radius:3px 3px 0 0;color:#fff}' +
  '.mini-h.up{background:#1e8449}.mini-h.dn{background:#c0392b}' +
  '.t-mini{width:100%;border-collapse:collapse;font-size:8.6px}' +
  '.t-mini td{padding:2.2px 5px;border-bottom:.5px solid #eceff3}' +
  '.t-mini tr.hr td{font-weight:700;color:#4b5563;font-size:7.6px;background:#f3f5f8}' +
  '.note{font-size:8.6px;line-height:1.45;text-align:justify}' +
  '.note b{color:#1e3a5f}' +
  '.warn{color:#c0392b;font-weight:700}' +
  '.t-det{width:100%;border-collapse:collapse;font-size:7.8px}' +
  '.t-det th{background:#1e3a5f;color:#fff;padding:2.6px 3px;font-weight:700;text-align:left;font-size:7.4px}' +
  '.t-det td{padding:1.8px 3px;border-bottom:.4px solid #e9edf2}' +
  '.t-det tr:nth-child(even) td{background:#fafbfc}' +
  '.r{text-align:right}.c{text-align:center}.b{font-weight:700}' +
  '.lo{color:#c0392b}.hi{color:#1e8449}' +
  '.ok{color:#1e8449;font-weight:700}.no{color:#c0392b}' +
  '.sec{font-size:10px;font-weight:700;text-transform:uppercase;color:#1e3a5f;margin:0 0 4px;padding-bottom:2px;border-bottom:1px solid #1e3a5f}' +
  '.sign{margin-top:10px;display:flex;justify-content:flex-end}' +
  '.sign div{width:48%;text-align:center;font-size:9px}' +
  '.pb{page-break-before:always}' +
  '.foot{margin-top:6px;font-size:7.4px;color:#6b7280;border-top:.5px solid #d7dce3;padding-top:3px}';

function shell(title, body) {
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>' + esc2(title) + '</title><style>' + CSS +
         '</style></head><body><div class="doc">' + body + '</div></body></html>';
}
function header(h1, sub) {
  return '<div class="hd"><div class="org">Ủy ban nhân dân tỉnh Cao Bằng · Sở Tài chính</div>' +
         '<h1>' + esc2(h1) + '</h1><div class="sub">' + sub + '</div></div>';
}
/* ---------- kiến nghị đối với đơn vị giải ngân chậm ---------- */
function kienNghiBox(mode) {
  var it = [];
  it.push('Tập trung chỉ đạo đơn vị được giao kinh phí đôn đốc nhà thầu đẩy nhanh tiến độ thi công; tổ chức nghiệm thu, thanh toán ngay khi có khối lượng hoàn thành, không để dồn vào cuối năm.');
  it.push('Đối với công trình, nhiệm vụ chi xác định không thể giải ngân hết trong năm 2026: báo cáo bằng văn bản về Sở Tài chính, nêu rõ số kinh phí, nguyên nhân và đề xuất xử lý để Sở tham mưu Ủy ban nhân dân tỉnh điều chuyển.');
  it.push('Rà soát, hoàn thiện hồ sơ thanh toán gửi Kho bạc Nhà nước; không để hồ sơ tồn đọng, chậm luân chuyển làm ảnh hưởng tiến độ giải ngân.');
  it.push('Phân công lãnh đạo trực tiếp theo dõi từng nhiệm vụ chi; xây dựng kế hoạch giải ngân chi tiết theo các mốc 10/12, 20/12 và 31/12/2026, cam kết tiến độ với Ủy ban nhân dân tỉnh.');
  if (mode === 'baolu') {
    it.push('Đơn vị chưa lựa chọn xong nhà thầu khẩn trương hoàn thành thủ tục đấu thầu, khởi công; trường hợp không thể hoàn thành trong năm phải báo cáo ngay để xử lý theo quy định về nguồn kinh phí khắc phục hậu quả thiên tai.');
  } else {
    it.push('Cập nhật đầy đủ, kịp thời số liệu trên hệ thống theo đúng thời hạn từng kỳ; đơn vị chưa gửi báo cáo chịu trách nhiệm trước Ủy ban nhân dân tỉnh.');
  }
  it.push('Giao Sở Tài chính theo dõi, tổng hợp, định kỳ báo cáo Ủy ban nhân dân tỉnh; đề xuất biểu dương đơn vị giải ngân tốt và phê bình đơn vị giải ngân chậm, không có chuyển biến qua các kỳ.');
  var h = '<div class="row"><div class="box" style="flex:1"><div class="t">Kiến nghị đối với đơn vị giải ngân chậm</div><div class="note">';
  it.forEach(function (x, i) { h += (i + 1) + '. ' + x + '<br>'; });
  return h + '</div></div></div>';
}

function signBlock() {
  var now = new Date();
  return '<div class="sign"><div>Cao Bằng, ngày ' + now.getDate() + ' tháng ' + (now.getMonth() + 1) + ' năm ' + now.getFullYear() +
         '<br><b>GIÁM ĐỐC</b></div></div>';
}

/* ---------- báo cáo giải ngân (tổng hợp / khối tỉnh / khối xã) ---------- */
function buildLeaderDoc(scope) {
  var D = collect(scope), rows = D.rows;
  var gi = 0, gn = 0;
  rows.forEach(function (r) { gi += r.gi; gn += r.gn; });
  var tl = pc(gn, gi);
  var sent = rows.filter(function (r) { return r.submitted; }).length;
  var notSent = rows.filter(function (r) { return !r.submitted; });
  var giam = rows.filter(function (r) { return r.giam; });

  var floor = gi * 0.005;
  var sig = rows.filter(function (r) { return r.gi >= floor; });
  if (sig.length < 10) sig = rows.slice();
  var top = sig.slice().sort(function (a, b) { return b.tl - a.tl; }).slice(0, 5);
  var bot = rows.slice().sort(function (a, b) { return b.con - a.con; }).slice(0, 5);

  var byRate = rows.slice().sort(function (a, b) { return a.tl - b.tl; });
  var half = Math.ceil(byRate.length / 2);
  var per = state.period || {};

  var sub = '<b>Kỳ báo cáo: ' + esc2(per.label || '—') + '</b>' +
            (per.cutoffText ? ' · Chốt số liệu: ' + esc2(per.cutoffText) : '') +
            ' · Phạm vi: ' + esc2(scopeText(scope)) +
            ' · Nguồn vốn: ' + esc2(D.progLabel) + ' · Đơn vị tính: ' + UNIT_TXT;

  var h = header('Báo cáo tình hình giải ngân vốn thường xuyên năm 2026', sub);

  h += '<div class="kpi">' +
    '<div><div class="k">Dự toán giao</div><div class="v">' + n0(gi) + '</div><div class="n">' + rows.length + ' đơn vị theo dõi</div></div>' +
    '<div><div class="k">Đã giải ngân</div><div class="v">' + n0(gn) + '</div><div class="n">lũy kế đến kỳ báo cáo</div></div>' +
    '<div><div class="k">Tỷ lệ giải ngân</div><div class="v big">' + pcTxt(tl) + '</div><div class="n">so với dự toán giao</div></div>' +
    '<div><div class="k">Còn lại</div><div class="v">' + n0(gi - gn) + '</div><div class="n">chưa giải ngân</div></div>' +
    '<div><div class="k">Nộp báo cáo</div><div class="v">' + sent + '/' + rows.length + '</div><div class="n">' + notSent.length + ' đơn vị chưa gửi</div></div>' +
    '</div>';

  h += '<div class="row">' +
    '<div class="box" style="flex:1.45"><div class="t">Tỷ lệ giải ngân theo nguồn vốn</div>' + barsBySource(scope) + '</div>' +
    '<div class="box" style="flex:1"><div class="t">Phân bố đơn vị theo mức giải ngân</div>' + barsByBand(rows) + '</div>' +
    '</div>';

  h += '<div class="row">' + miniTable('5 đơn vị giải ngân cao nhất', top, 'up', 'Dự toán', 'Đã giải ngân') +
       miniTable('5 đơn vị có số còn lại lớn nhất – cần đôn đốc', bot, 'dn', 'Dự toán', 'Còn lại') + '</div>';

  h += '<div class="row"><div class="box" style="flex:1"><div class="t">Nhận xét, đề nghị</div><div class="note">';
  h += '1. ' + esc2(scopeText(scope)) + ' giải ngân <b>' + n0(gn) + '/' + n0(gi) + ' ' + UNIT_TXT + '</b>, đạt <b>' + pcTxt(tl) +
       '</b> dự toán giao; số còn lại phải giải ngân là <b>' + n0(gi - gn) + ' ' + UNIT_TXT + '</b>.<br>';
  h += '2. Có <b>' + rows.filter(function (r) { return r.tl < 50; }).length + ' đơn vị</b> giải ngân dưới 50%, đề nghị kiểm điểm tiến độ và cam kết lộ trình hoàn thành trước 31/12/2026.<br>';
  var i = 3;
  if (giam.length) {
    h += i++ + '. <span class="warn">Số liệu giảm so với kỳ trước</span> tại ' + giam.length + ' đơn vị: ' +
      esc2(giam.slice(0, 12).map(function (r) { return r.name; }).join('; ')) + (giam.length > 12 ? '…' : '') + '. Đề nghị các đơn vị giải trình.<br>';
  }
  if (notSent.length) {
    h += i++ + '. <b>Chưa gửi báo cáo kỳ này (' + notSent.length + '):</b> ' +
      esc2(notSent.map(function (r) { return r.name; }).join('; ')) + '.<br>';
  }
  h += '<i>Các đơn vị chịu trách nhiệm trước Ủy ban nhân dân tỉnh về tính chính xác, trung thực của số liệu đã nhập.</i>';
  h += '</div></div></div>';

  h += kienNghiBox('all');
  h += signBlock();
  h += '<div class="foot">Nguồn: Hệ thống theo dõi giải ngân vốn thường xuyên – Sở Tài chính tỉnh Cao Bằng. Ký hiệu: ▼ số liệu giảm so với kỳ trước; ✓ đã gửi báo cáo.</div>';

  h += '<div class="pb"><div class="sec">Phụ lục: Chi tiết giải ngân từng đơn vị (xếp theo tỷ lệ từ thấp đến cao)</div>' +
    '<div class="row">' +
    '<div style="flex:1">' + detailHalf(byRate.slice(0, half), 1) + '</div>' +
    '<div style="flex:1">' + detailHalf(byRate.slice(half), half + 1) + '</div>' +
    '</div></div>';

  return shell('Báo cáo giải ngân – ' + scopeText(scope) + ' – Kỳ ' + (per.label || ''), h);
}

/* ---------- báo cáo Mục VI: kinh phí bão lũ ---------- */
function baoLuRows() {
  return ((state.baoLu || {}).units || []).map(function (u) {
    var plan = Number(u.plan) || 0, spent = Number(u.spent) || 0;
    return {
      name: u.name, kind: u.kind, gi: plan, gn: spent, con: plan - spent,
      dt: Number(u.dt) || 0, tx: Number(u.tx) || 0,
      projects: Number(u.projects) || 0, contracted: Number(u.contracted) || 0,
      tl: pc(spent, plan)
    };
  }).filter(function (r) { return r.gi > 0; });
}

function baoLuHalf(arr, start) {
  var h = '<table class="t-det"><thead><tr><th>TT</th><th>Đơn vị</th><th class="r">Vốn giao</th><th class="r">Đã thanh toán</th><th class="r">Tỷ lệ</th><th class="c">Gói thầu</th></tr></thead><tbody>';
  arr.forEach(function (r, i) {
    var cls = r.tl < 50 ? 'lo' : r.tl >= 90 ? 'hi' : '';
    h += '<tr><td class="c">' + (start + i) + '</td><td>' + esc2(r.name) + '</td>' +
         '<td class="r">' + n0(r.gi) + '</td><td class="r">' + n0(r.gn) + '</td>' +
         '<td class="r b ' + cls + '">' + pcTxt(r.tl) + '</td>' +
         '<td class="c">' + r.contracted + '/' + r.projects + '</td></tr>';
  });
  return h + '</tbody></table>';
}

function buildBaoLuDoc() {
  var rows = baoLuRows();
  var gi = 0, gn = 0, dt = 0, tx = 0, prj = 0, ctr = 0;
  rows.forEach(function (r) { gi += r.gi; gn += r.gn; dt += r.dt; tx += r.tx; prj += r.projects; ctr += r.contracted; });
  var tl = pc(gn, gi);
  var per = state.period || {};
  var bl = state.baoLu || {};

  var floor = gi * 0.005;
  var sig = rows.filter(function (r) { return r.gi >= floor; });
  if (sig.length < 8) sig = rows.slice();
  var top = sig.slice().sort(function (a, b) { return b.tl - a.tl; }).slice(0, 5);
  var bot = rows.slice().sort(function (a, b) { return b.con - a.con; }).slice(0, 5);

  var byRate = rows.slice().sort(function (a, b) { return a.tl - b.tl; });
  var half = Math.ceil(byRate.length / 2);
  var duoi50 = rows.filter(function (r) { return r.tl < 50; });

  var sub = '<b>Kỳ báo cáo: ' + esc2(per.label || '—') + '</b>' +
            (bl.preloadedAsOf ? ' · Số liệu nền đến ' + esc2(bl.preloadedAsOf) : '') +
            ' · ' + rows.length + ' đơn vị được giao · Đơn vị tính: ' + UNIT_TXT;

  var h = header('Báo cáo kinh phí khắc phục hậu quả bão lũ nguồn NSTW giao năm 2026', sub);

  h += '<div class="kpi">' +
    '<div><div class="k">Vốn NSTW giao</div><div class="v">' + n0(gi) + '</div><div class="n">tổng kinh phí giao trong năm</div></div>' +
    '<div><div class="k">Đã thanh toán</div><div class="v">' + n0(gn) + '</div><div class="n">ĐT ' + n0(dt) + ' · TX ' + n0(tx) + '</div></div>' +
    '<div><div class="k">Tỷ lệ thanh toán</div><div class="v big">' + pcTxt(tl) + '</div><div class="n">đã thanh toán / vốn giao</div></div>' +
    '<div><div class="k">Còn lại</div><div class="v">' + n0(gi - gn) + '</div><div class="n">chưa thanh toán</div></div>' +
    '<div><div class="k">Chọn nhà thầu</div><div class="v">' + ctr + '/' + prj + '</div><div class="n">công trình đã chọn xong</div></div>' +
    '</div>';

  h += '<div class="row">' +
    '<div class="box" style="flex:1"><div class="t">Phân bố đơn vị theo mức thanh toán</div>' + barsByBand(rows) + '</div>' +
    '<div class="box" style="flex:1"><div class="t">Cơ cấu thanh toán</div><div class="note" style="padding-top:4px">' +
      'Chi đầu tư: <b>' + n0(dt) + ' ' + UNIT_TXT + '</b> (' + pcTxt(pc(dt, gn)) + ' số đã thanh toán).<br>' +
      'Chi thường xuyên: <b>' + n0(tx) + ' ' + UNIT_TXT + '</b> (' + pcTxt(pc(tx, gn)) + ').<br>' +
      'Số chưa thanh toán: <b>' + n0(gi - gn) + ' ' + UNIT_TXT + '</b>.<br>' +
      'Công trình chưa lựa chọn xong nhà thầu: <b>' + (prj - ctr) + '/' + prj + '</b>.' +
    '</div></div></div>';

  h += '<div class="row">' + miniTable('5 đơn vị thanh toán cao nhất', top, 'up', 'Vốn giao', 'Đã thanh toán') +
       miniTable('5 đơn vị có số còn lại lớn nhất – cần đôn đốc', bot, 'dn', 'Vốn giao', 'Còn lại') + '</div>';

  h += '<div class="row"><div class="box" style="flex:1"><div class="t">Nhận xét, đề nghị</div><div class="note">';
  h += '1. Toàn tỉnh đã thanh toán <b>' + n0(gn) + '/' + n0(gi) + ' ' + UNIT_TXT + '</b>, đạt <b>' + pcTxt(tl) +
       '</b> vốn NSTW giao; số còn lại là <b>' + n0(gi - gn) + ' ' + UNIT_TXT + '</b>.<br>';
  h += '2. Có <b>' + duoi50.length + ' đơn vị</b> thanh toán dưới 50%, đề nghị khẩn trương hoàn thiện thủ tục nghiệm thu, thanh toán.<br>';
  h += '3. Kinh phí Mục VI <b>không tổng hợp</b> vào tổng dự toán, tổng giải ngân và tỷ lệ giải ngân các Mục I–V.<br>';
  h += '<i>Các đơn vị chịu trách nhiệm trước Ủy ban nhân dân tỉnh về tính chính xác, trung thực của số liệu đã nhập.</i>';
  h += '</div></div></div>';

  h += kienNghiBox('baolu');
  h += signBlock();
  h += '<div class="foot">Nguồn: Hệ thống theo dõi giải ngân vốn thường xuyên – Sở Tài chính tỉnh Cao Bằng. Cột "Gói thầu": số công trình đã lựa chọn xong nhà thầu / tổng số công trình.</div>';

  h += '<div class="pb"><div class="sec">Phụ lục: Chi tiết kinh phí bão lũ từng đơn vị (xếp theo tỷ lệ từ thấp đến cao)</div>' +
    '<div class="row">' +
    '<div style="flex:1">' + baoLuHalf(byRate.slice(0, half), 1) + '</div>' +
    '<div style="flex:1">' + baoLuHalf(byRate.slice(half), half + 1) + '</div>' +
    '</div></div>';

  return shell('Báo cáo Mục VI – Kinh phí bão lũ – Kỳ ' + (per.label || ''), h);
}

/* ---------- mở & in ---------- */
function printDoc(html) {
  var w = window.open('', '_blank');
  if (w) {
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400);
    return;
  }
  var f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(function () {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
    setTimeout(function () { f.remove(); }, 2000);
  }, 400);
}

function printLeaderReport(scope) {
  printDoc(scope === 'baolu' ? buildBaoLuDoc() : buildLeaderDoc(scope || 'all'));
}

/* ---------- hộp chọn loại báo cáo ---------- */
function openMenu() {
  var old = document.getElementById('leaderPrintMenu');
  if (old) { old.remove(); return; }

  var wrap = document.createElement('div');
  wrap.id = 'leaderPrintMenu';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px';

  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#111;border-radius:12px;max-width:420px;width:100%;padding:16px 16px 10px;box-shadow:0 18px 48px rgba(0,0,0,.28)';
  card.innerHTML = '<div style="font-size:15px;font-weight:700;color:#1e3a5f;margin-bottom:2px">Chọn loại báo cáo để in</div>' +
                   '<div style="font-size:12px;color:#6b7280;margin-bottom:10px">Bản rút gọn 2 trang A4, có biểu đồ, phục vụ lãnh đạo tỉnh.</div>';

  SCOPES.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:8px;padding:9px 11px;border:1px solid #d7dce3;border-radius:8px;background:#fafbfc;cursor:pointer;font-size:13px;line-height:1.3';
    b.innerHTML = '<span style="font-weight:700;color:#1e3a5f">' + s.label + '</span><br><span style="font-size:11px;color:#6b7280">' + s.note + '</span>';
    b.addEventListener('mouseenter', function () { b.style.background = '#eef2f7'; });
    b.addEventListener('mouseleave', function () { b.style.background = '#fafbfc'; });
    b.addEventListener('click', function () { wrap.remove(); printLeaderReport(s.key); });
    card.appendChild(b);
  });

  var close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Đóng';
  close.style.cssText = 'display:block;margin:2px 0 6px auto;padding:6px 14px;border:0;background:transparent;color:#6b7280;cursor:pointer;font-size:12px';
  close.addEventListener('click', function () { wrap.remove(); });
  card.appendChild(close);

  wrap.appendChild(card);
  wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { var m = document.getElementById('leaderPrintMenu'); if (m) m.remove(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(wrap);
}

window.printLeaderReport = printLeaderReport;
window.openLeaderPrintMenu = openMenu;

/* Gắn nút "Báo cáo lãnh đạo" và ẩn nút "In báo cáo" cũ (bản in dài, dàn trải) */
function mount() {
  var oldBtn = document.querySelector('[title*="In báo cáo theo bộ lọc"]');
  var anchor = oldBtn || document.getElementById('mtqgPrintBtn');
  if (!anchor || !anchor.parentNode) return;
  if (!document.getElementById('leaderPrintBtn')) {
    var b = document.createElement('button');
    b.id = 'leaderPrintBtn';
    b.type = 'button';
    b.className = anchor.className;
    b.title = 'In báo cáo rút gọn phục vụ lãnh đạo tỉnh (2 trang A4, có biểu đồ)';
    b.textContent = 'Báo cáo lãnh đạo';
    b.addEventListener('click', openMenu);
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
  }
  if (oldBtn) oldBtn.style.display = 'none';
}
document.addEventListener('DOMContentLoaded', mount);
if (document.readyState !== 'loading') mount();
var mt = 0;
var miv = setInterval(function () {
  mount();
  if (document.getElementById('leaderPrintBtn') || ++mt > 40) clearInterval(miv);
}, 400);

})();

/* ============================================================
   BÁO CÁO NHANH — hiển thị ngay trên màn hình (không tải file)
   Bấm nút "Báo cáo nhanh" -> chọn đơn vị -> báo cáo mở ra để xem/in.
   Vẫn giữ nút tải bản Word ở hộp chọn đơn vị.
   ============================================================ */
(function () {
'use strict';

var BASE_CSS = '' +
  '@page{size:A4 portrait;margin:10mm 9mm}' +
  '*{box-sizing:border-box}' +
  'body{font:10px/1.35 "Times New Roman",Times,serif;color:#111;margin:0}' +
  '.doc{width:100%}' +
  '.hd{text-align:center;border-bottom:1.6px solid #1e3a5f;padding-bottom:5px;margin-bottom:7px}' +
  '.hd .org{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}' +
  '.hd h1{font-size:15px;margin:3px 0 2px;text-transform:uppercase;color:#1e3a5f}' +
  '.hd .sub{font-size:9.5px;color:#374151}' +
  '.kpi{display:flex;gap:5px;margin:7px 0}' +
  '.kpi>div{flex:1;border:.8px solid #d7dce3;border-radius:4px;padding:5px 6px;background:#fafbfc}' +
  '.kpi .k{font-size:7.6px;text-transform:uppercase;letter-spacing:.3px;color:#6b7280}' +
  '.kpi .v{font-size:14px;font-weight:700;color:#1e3a5f;line-height:1.15}' +
  '.kpi .n{font-size:7.4px;color:#6b7280}' +
  '.kpi .big{color:#1e8449}' +
  '.row{display:flex;gap:8px;margin-top:6px}' +
  '.box{border:.8px solid #d7dce3;border-radius:4px;padding:5px 7px}' +
  '.box>.t{font-size:8.6px;font-weight:700;text-transform:uppercase;color:#1e3a5f;margin-bottom:4px;letter-spacing:.3px}' +
  '.mini{flex:1}' +
  '.mini-h{font-size:8.4px;font-weight:700;padding:3px 5px;border-radius:3px 3px 0 0;color:#fff}' +
  '.mini-h.up{background:#1e8449}.mini-h.dn{background:#c0392b}' +
  '.t-mini{width:100%;border-collapse:collapse;font-size:8.6px}' +
  '.t-mini td{padding:2.2px 5px;border-bottom:.5px solid #eceff3}' +
  '.t-mini tr.hr td{font-weight:700;color:#4b5563;font-size:7.6px;background:#f3f5f8}' +
  '.note{font-size:8.6px;line-height:1.45;text-align:justify}' +
  '.note b{color:#1e3a5f}' +
  '.warn{color:#c0392b;font-weight:700}' +
  '.t-det{width:100%;border-collapse:collapse;font-size:7.8px}' +
  '.t-det th{background:#1e3a5f;color:#fff;padding:2.6px 3px;font-weight:700;text-align:left;font-size:7.4px}' +
  '.t-det td{padding:1.8px 3px;border-bottom:.4px solid #e9edf2}' +
  '.t-det tr:nth-child(even) td{background:#fafbfc}' +
  '.r{text-align:right}.c{text-align:center}.b{font-weight:700}' +
  '.lo{color:#c0392b}.hi{color:#1e8449}' +
  '.ok{color:#1e8449;font-weight:700}.no{color:#c0392b}' +
  '.sec{font-size:10px;font-weight:700;text-transform:uppercase;color:#1e3a5f;margin:0 0 4px;padding-bottom:2px;border-bottom:1px solid #1e3a5f}' +
  '.sign{margin-top:10px;display:flex;justify-content:flex-end}' +
  '.sign div{width:48%;text-align:center;font-size:9px}' +
  '.pb{page-break-before:always}' +
  '.foot{margin-top:6px;font-size:7.4px;color:#6b7280;border-top:.5px solid #d7dce3;padding-top:3px}';

function n0(v) { return (Number(v) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }); }
function pc(a, b) { return b > 0 ? (a / b) * 100 : 0; }
function pcTxt(v) { return (Number(v) || 0).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
function ptTxt(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function esc2(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

function leaderOf(name) {
  try {
    var L = (ASSIGNMENT_DATA && ASSIGNMENT_DATA.leaders) || [];
    for (var i = 0; i < L.length; i++) if ((L[i].areas || []).indexOf(name) >= 0) return L[i].name;
  } catch (e) {}
  return '';
}

function allRows() {
  return (state.units || []).map(function (u) {
    var a = (u.p || {}).all || [0, 0], b = (u.prev || {}).all || [0, 0];
    var gi = Number(a[0]) || 0, gn = Number(a[1]) || 0;
    var ptl = pc(Number(b[1]) || 0, Number(b[0]) || 0);
    return {
      name: u.name, kind: u.kind, submitted: !!u.submitted,
      gi: gi, gn: gn, con: gi - gn, tl: pc(gn, gi),
      delta: pc(gn, gi) - ptl,
      giam: (Number(b[1]) || 0) > 0 && gn < (Number(b[1]) || 0) - 0.0001,
      leader: leaderOf(u.name)
    };
  }).filter(function (r) { return r.gi > 0; });
}

function timePct() {
  var now = new Date(), y = now.getFullYear();
  var start = new Date(y, 0, 1), end = new Date(y + 1, 0, 1);
  return (now - start) / (end - start) * 100;
}

/* biểu đồ thanh: tỷ lệ từng đơn vị + mốc bình quân tỉnh + mốc tiến độ thời gian */
function barsQuick(rows, avg, tpc) {
  var H = 17, W = 460, LBL = 168, BW = W - LBL - 40;
  var x0 = function (p) { return LBL + BW * Math.min(Math.max(p, 0), 100) / 100; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + (rows.length * H + 22) + '" width="100%">';
  rows.forEach(function (r, i) {
    var y = i * H + 4, w = Math.max(1.5, BW * Math.min(r.tl, 100) / 100);
    var col = r.tl < avg ? '#c0392b' : r.tl < 90 ? '#2d7dd2' : '#1e8449';
    svg += '<text x="0" y="' + (y + 9) + '" font-size="7.8" fill="#1f2937">' + esc2(r.name) + '</text>';
    svg += '<rect x="' + LBL + '" y="' + (y + 2) + '" width="' + BW + '" height="9" rx="2" fill="#e8ebef"/>';
    svg += '<rect x="' + LBL + '" y="' + (y + 2) + '" width="' + w + '" height="9" rx="2" fill="' + col + '"/>';
    svg += '<text x="' + (LBL + BW + 3) + '" y="' + (y + 9.5) + '" font-size="7.8" font-weight="700" fill="' + col + '">' + pcTxt(r.tl) + '</text>';
  });
  var hTot = rows.length * H + 2;
  svg += '<line x1="' + x0(avg) + '" y1="2" x2="' + x0(avg) + '" y2="' + hTot + '" stroke="#1e3a5f" stroke-width="1" stroke-dasharray="3 2"/>';
  svg += '<line x1="' + x0(tpc) + '" y1="2" x2="' + x0(tpc) + '" y2="' + hTot + '" stroke="#d68910" stroke-width="1" stroke-dasharray="1 2"/>';
  svg += '<text x="' + LBL + '" y="' + (hTot + 14) + '" font-size="7.2" fill="#1e3a5f">--- Bình quân tỉnh ' + pcTxt(avg) + '</text>';
  svg += '<text x="' + (LBL + 120) + '" y="' + (hTot + 14) + '" font-size="7.2" fill="#d68910">··· Tiến độ thời gian ' + pcTxt(tpc) + '</text>';
  return svg + '</svg>';
}

/* ---------- kiến nghị đối với đơn vị giải ngân chậm ---------- */
function kienNghiBox(mode) {
  var it = [];
  it.push('Tập trung chỉ đạo đơn vị được giao kinh phí đôn đốc nhà thầu đẩy nhanh tiến độ thi công; tổ chức nghiệm thu, thanh toán ngay khi có khối lượng hoàn thành, không để dồn vào cuối năm.');
  it.push('Đối với công trình, nhiệm vụ chi xác định không thể giải ngân hết trong năm 2026: báo cáo bằng văn bản về Sở Tài chính, nêu rõ số kinh phí, nguyên nhân và đề xuất xử lý để Sở tham mưu Ủy ban nhân dân tỉnh điều chuyển.');
  it.push('Rà soát, hoàn thiện hồ sơ thanh toán gửi Kho bạc Nhà nước; không để hồ sơ tồn đọng, chậm luân chuyển làm ảnh hưởng tiến độ giải ngân.');
  it.push('Phân công lãnh đạo trực tiếp theo dõi từng nhiệm vụ chi; xây dựng kế hoạch giải ngân chi tiết theo các mốc 10/12, 20/12 và 31/12/2026, cam kết tiến độ với Ủy ban nhân dân tỉnh.');
  if (mode === 'baolu') {
    it.push('Đơn vị chưa lựa chọn xong nhà thầu khẩn trương hoàn thành thủ tục đấu thầu, khởi công; trường hợp không thể hoàn thành trong năm phải báo cáo ngay để xử lý theo quy định về nguồn kinh phí khắc phục hậu quả thiên tai.');
  } else {
    it.push('Cập nhật đầy đủ, kịp thời số liệu trên hệ thống theo đúng thời hạn từng kỳ; đơn vị chưa gửi báo cáo chịu trách nhiệm trước Ủy ban nhân dân tỉnh.');
  }
  it.push('Giao Sở Tài chính theo dõi, tổng hợp, định kỳ báo cáo Ủy ban nhân dân tỉnh; đề xuất biểu dương đơn vị giải ngân tốt và phê bình đơn vị giải ngân chậm, không có chuyển biến qua các kỳ.');
  var h = '<div class="row"><div class="box" style="flex:1"><div class="t">Kiến nghị đối với đơn vị giải ngân chậm</div><div class="note">';
  it.forEach(function (x, i) { h += (i + 1) + '. ' + x + '<br>'; });
  return h + '</div></div></div>';
}

function quickDetail(rows) {
  var h = '<table class="t-det"><thead><tr><th>TT</th><th>Đơn vị</th><th class="r">Dự toán</th><th class="r">Đã giải ngân</th>' +
          '<th class="r">Còn lại</th><th class="r">Tỷ lệ</th><th class="r">So kỳ trước</th><th class="c">Nộp</th><th>Lãnh đạo phụ trách</th></tr></thead><tbody>';
  rows.forEach(function (r, i) {
    var cls = r.tl < 50 ? 'lo' : r.tl >= 90 ? 'hi' : '';
    h += '<tr><td class="c">' + (i + 1) + '</td><td>' + esc2(r.name) + '</td>' +
         '<td class="r">' + n0(r.gi) + '</td><td class="r">' + n0(r.gn) + '</td><td class="r">' + n0(r.con) + '</td>' +
         '<td class="r b ' + cls + '">' + pcTxt(r.tl) + '</td>' +
         '<td class="r' + (r.giam ? ' warn' : '') + '">' + ptTxt(r.delta) + ' điểm %</td>' +
         '<td class="c">' + (r.submitted ? '<span class="ok">✓</span>' : '<span class="no">–</span>') + '</td>' +
         '<td>' + esc2(r.leader || '—') + '</td></tr>';
  });
  return h + '</tbody></table>';
}

function buildQuickHtml(picked) {
  var all = allRows();
  var set = {}; picked.forEach(function (n) { set[n] = 1; });
  var rows = all.filter(function (r) { return set[r.name]; }).sort(function (a, b) { return a.tl - b.tl; });

  var tGi = 0, tGn = 0; all.forEach(function (r) { tGi += r.gi; tGn += r.gn; });
  var avg = pc(tGn, tGi);
  var gi = 0, gn = 0; rows.forEach(function (r) { gi += r.gi; gn += r.gn; });
  var tl = pc(gn, gi), tpc = timePct();

  var duoiBQ = rows.filter(function (r) { return r.tl < avg; });
  var giam = rows.filter(function (r) { return r.giam; });
  var chuaGui = rows.filter(function (r) { return !r.submitted; });
  var per = state.period || {};

  var sub = '<b>Kỳ báo cáo: ' + esc2(per.label || '—') + '</b>' +
            (per.cutoffText ? ' · Chốt số liệu: ' + esc2(per.cutoffText) : '') +
            ' · ' + rows.length + ' đơn vị được chọn · Đơn vị tính: triệu đồng';

  var h = '<div class="noprint bar"><button onclick="window.print()">In báo cáo</button>' +
          '<span>Báo cáo hiển thị trực tiếp, không cần tải file. Khi in, bỏ chọn "Headers and footers".</span></div>';

  h += '<div class="hd"><div class="org">Ủy ban nhân dân tỉnh Cao Bằng · Sở Tài chính</div>' +
       '<h1>Báo cáo nhanh tình hình giải ngân vốn thường xuyên</h1><div class="sub">' + sub + '</div></div>';

  h += '<div class="kpi">' +
    '<div><div class="k">Dự toán nhóm</div><div class="v">' + n0(gi) + '</div><div class="n">' + rows.length + ' đơn vị</div></div>' +
    '<div><div class="k">Đã giải ngân</div><div class="v">' + n0(gn) + '</div><div class="n">lũy kế đến kỳ báo cáo</div></div>' +
    '<div><div class="k">Tỷ lệ nhóm</div><div class="v big">' + pcTxt(tl) + '</div><div class="n">' + (tl >= avg ? 'cao hơn' : 'thấp hơn') + ' bình quân tỉnh</div></div>' +
    '<div><div class="k">Bình quân tỉnh</div><div class="v">' + pcTxt(avg) + '</div><div class="n">tiến độ thời gian ' + pcTxt(tpc) + '</div></div>' +
    '<div><div class="k">Nộp báo cáo</div><div class="v">' + (rows.length - chuaGui.length) + '/' + rows.length + '</div><div class="n">' + chuaGui.length + ' đơn vị chưa gửi</div></div>' +
    '</div>';

  if (rows.length <= 26) {
    h += '<div class="row"><div class="box" style="flex:1"><div class="t">Tỷ lệ giải ngân từng đơn vị</div>' +
         barsQuick(rows, avg, tpc) + '</div></div>';
  }

  h += '<div class="row"><div class="box" style="flex:1"><div class="t">Nhận xét, đề nghị</div><div class="note">';
  h += '1. Tổng dự toán của ' + rows.length + ' đơn vị là <b>' + n0(gi) + ' triệu đồng</b>, đã giải ngân <b>' + n0(gn) +
       ' triệu đồng</b>, đạt <b>' + pcTxt(tl) + '</b>, ' + (tl >= avg ? 'cao hơn' : 'thấp hơn') + ' bình quân toàn tỉnh (' + pcTxt(avg) +
       ') và ' + (tl >= tpc ? 'bảo đảm' : 'chậm so với') + ' tiến độ thời gian (' + pcTxt(tpc) + ').<br>';
  var i = 2;
  h += i++ + '. Thấp hơn bình quân tỉnh: ' + (duoiBQ.length ? '<b>' + duoiBQ.length + ' đơn vị</b> – ' +
       esc2(duoiBQ.map(function (r) { return r.name + ' (' + pcTxt(r.tl) + ')'; }).join('; ')) +
       '. Đề nghị đẩy nhanh giải ngân, lập danh sách phần kinh phí còn lại và nêu rõ thời điểm dự kiến giải ngân.'
       : 'không có đơn vị nào.') + '<br>';
  if (giam.length) {
    h += i++ + '. <span class="warn">Số giải ngân giảm so với kỳ trước</span> tại ' + giam.length + ' đơn vị: ' +
         esc2(giam.map(function (r) { return r.name; }).join('; ')) + '. Đề nghị giải trình nguyên nhân và biện pháp khắc phục.<br>';
  }
  if (chuaGui.length) {
    h += i++ + '. Chưa gửi báo cáo kỳ ' + esc2(per.label || '') + ': <b>' + esc2(chuaGui.map(function (r) { return r.name; }).join('; ')) +
         '</b>. Đề nghị khẩn trương cập nhật và gửi báo cáo đúng thời hạn.<br>';
  }
  h += i++ + '. Đề nghị các đơn vị tiếp tục theo dõi, cập nhật tiến độ theo kỳ và có kế hoạch giải ngân cụ thể đến 31/12/2026.<br>';
  h += '<i>Các đơn vị chịu trách nhiệm trước Ủy ban nhân dân tỉnh về tính chính xác, trung thực của số liệu đã nhập.</i>';
  h += '</div></div></div>';

  h += kienNghiBox('all');

  h += '<div style="margin-top:7px"><div class="sec">Chi tiết từng đơn vị (xếp theo tỷ lệ từ thấp đến cao)</div>' +
       quickDetail(rows) + '</div>';

  h += '<div class="foot">Nguồn: Hệ thống theo dõi giải ngân vốn thường xuyên – Sở Tài chính tỉnh Cao Bằng. ' +
       'Cột "So kỳ trước" tính bằng điểm phần trăm tỷ lệ giải ngân.</div>';

  var css = BASE_CSS +
    '@media screen{body{background:#eef1f5;padding:14px 0}' +
      '.doc{background:#fff;width:210mm;max-width:96vw;margin:0 auto;padding:10mm 9mm;box-shadow:0 3px 16px rgba(0,0,0,.14)}}' +
    '.bar{background:#1e3a5f;color:#fff;padding:7px 10px;margin:-10mm -9mm 8px;font-size:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
    '.bar button{padding:5px 14px;border:0;border-radius:6px;background:#fff;color:#1e3a5f;font-weight:700;cursor:pointer}' +
    '@media print{.noprint{display:none!important}}';

  return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo nhanh – Kỳ ' + esc2(per.label || '') +
         '</title><style>' + css + '</style></head><body><div class="doc">' + h + '</div></body></html>';
}

function showQuick(picked) {
  var html = buildQuickHtml(picked);
  var w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); try { w.focus(); } catch (e) {} return; }
  alert('Trình duyệt đang chặn cửa sổ mới. Hãy cho phép pop-up cho trang này rồi bấm lại.');
}

/* ---------- hộp chọn đơn vị ---------- */
function openQuickPicker() {
  var old = document.getElementById('quickViewPicker');
  if (old) { old.remove(); return; }
  var rows = allRows().sort(function (a, b) { return a.name.localeCompare(b.name, 'vi'); });

  var wrap = document.createElement('div');
  wrap.id = 'quickViewPicker';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#111;border-radius:12px;max-width:520px;width:100%;max-height:86vh;display:flex;flex-direction:column;padding:14px;box-shadow:0 18px 48px rgba(0,0,0,.28)';
  card.innerHTML = '<div style="font-size:15px;font-weight:700;color:#1e3a5f">Báo cáo nhanh – chọn đơn vị</div>' +
                   '<div style="font-size:12px;color:#6b7280;margin-bottom:8px">Chọn xong bấm "Xem báo cáo", báo cáo hiện ngay để xem và in.</div>';

  var tools = document.createElement('div');
  tools.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap';
  var search = document.createElement('input');
  search.type = 'text'; search.placeholder = 'Tìm đơn vị…';
  search.style.cssText = 'flex:1;min-width:150px;padding:6px 9px;border:1px solid #d7dce3;border-radius:7px;font-size:13px';
  tools.appendChild(search);
  [['Tất cả xã, phường', 'commune'], ['Tất cả sở, ngành', 'agency'], ['Bỏ chọn', 'none']].forEach(function (t) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = t[0];
    b.style.cssText = 'padding:6px 10px;border:1px solid #d7dce3;border-radius:7px;background:#fafbfc;cursor:pointer;font-size:12px';
    b.addEventListener('click', function () {
      list.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
        if (t[1] === 'none') cb.checked = false;
        else if (t[1] === 'commune') cb.checked = cb.dataset.kind === 'commune' ? true : cb.checked;
        else cb.checked = cb.dataset.kind !== 'commune' ? true : cb.checked;
      });
      count();
    });
    tools.appendChild(b);
  });
  card.appendChild(tools);

  var list = document.createElement('div');
  list.style.cssText = 'flex:1;overflow:auto;border:1px solid #e5e9ef;border-radius:8px;padding:6px';
  rows.forEach(function (r) {
    var lab = document.createElement('label');
    lab.style.cssText = 'display:flex;gap:7px;align-items:center;padding:3px 5px;font-size:13px;cursor:pointer';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = r.name; cb.dataset.kind = r.kind;
    cb.addEventListener('change', count);
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(r.name + ' — ' + pcTxt(r.tl)));
    list.appendChild(lab);
  });
  card.appendChild(list);

  search.addEventListener('input', function () {
    var q = search.value.toLowerCase();
    list.querySelectorAll('label').forEach(function (l) {
      l.style.display = l.textContent.toLowerCase().indexOf(q) >= 0 ? 'flex' : 'none';
    });
  });

  var foot = document.createElement('div');
  foot.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:10px';
  var info = document.createElement('span');
  info.style.cssText = 'flex:1;font-size:12px;color:#6b7280';
  foot.appendChild(info);

  function count() {
    info.textContent = 'Đã chọn ' + list.querySelectorAll('input:checked').length + ' đơn vị';
  }
  function picked() {
    return [].map.call(list.querySelectorAll('input:checked'), function (cb) { return cb.value; });
  }

  var word = document.createElement('button');
  word.type = 'button'; word.textContent = 'Tải bản Word';
  word.title = 'Dùng chức năng xuất Word sẵn có';
  word.style.cssText = 'padding:7px 12px;border:1px solid #d7dce3;border-radius:7px;background:#fafbfc;cursor:pointer;font-size:13px';
  word.addEventListener('click', function () {
    wrap.remove();
    var btn = document.getElementById('quickReportBtn');
    if (!btn) return;
    var ev = new MouseEvent('click', { bubbles: true });
    ev.__allowWord = true;
    btn.dispatchEvent(ev);
  });
  foot.appendChild(word);

  var go = document.createElement('button');
  go.type = 'button'; go.textContent = 'Xem báo cáo';
  go.style.cssText = 'padding:7px 16px;border:0;border-radius:7px;background:#1e3a5f;color:#fff;font-weight:700;cursor:pointer;font-size:13px';
  go.addEventListener('click', function () {
    var p = picked();
    if (!p.length) { info.textContent = 'Chưa chọn đơn vị nào'; return; }
    wrap.remove();
    showQuick(p);
  });
  foot.appendChild(go);

  var close = document.createElement('button');
  close.type = 'button'; close.textContent = 'Đóng';
  close.style.cssText = 'padding:7px 12px;border:0;background:transparent;color:#6b7280;cursor:pointer;font-size:12px';
  close.addEventListener('click', function () { wrap.remove(); });
  foot.appendChild(close);

  card.appendChild(foot);
  count();
  wrap.appendChild(card);
  wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}

window.openQuickViewReport = openQuickPicker;

/* Chặn nút "Báo cáo nhanh" sẵn có: bấm 1 cái là hiện báo cáo, không tải file.
   Nút "Tải bản Word" trong hộp chọn vẫn gọi lại chức năng xuất Word gốc. */
function hookQuick() {
  var btn = document.getElementById('quickReportBtn');
  if (!btn || btn.dataset.viewHooked) return;
  btn.dataset.viewHooked = '1';
  btn.addEventListener('click', function (e) {
    if (e.__allowWord) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (!state.hasData) { alert('Chưa có số liệu. Bấm "Cập nhật" rồi thử lại.'); return; }
    openQuickPicker();
  }, true);
  btn.title = 'Báo cáo nhanh cho nhóm đơn vị được chọn – hiện ngay trên màn hình';
}
document.addEventListener('DOMContentLoaded', hookQuick);
var tries = 0;
var iv = setInterval(function () {
  hookQuick();
  if (document.getElementById('quickReportBtn') || ++tries > 40) clearInterval(iv);
}, 400);
hookQuick();

})();
