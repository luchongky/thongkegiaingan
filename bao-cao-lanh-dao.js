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
var AI_HTML = ''; // phần nhận định do AI hỗ trợ (nếu lãnh đạo chọn)

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

function timePct() {
  var now = new Date(), y = now.getFullYear();
  return (now - new Date(y, 0, 1)) / (new Date(y + 1, 0, 1) - new Date(y, 0, 1)) * 100;
}

function remindNotSent() {
  /* Chỉ nhắc đơn vị chưa gửi khi in vào NGÀY KẾ TIẾP ngày chốt kỳ.
     In trước khi hết kỳ: không nhắc. Quá 1 ngày sau chốt: coi như đã sang kỳ mới, không nhắc. */
  var k = (state.period || {}).key;
  if (!k) return false;
  var a = k.split('-');
  if (a.length !== 3) return false;
  var d0 = new Date(+a[0], +a[1] - 1, +a[2]);
  var now = new Date();
  var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t0 - d0) / 86400000) === 1;
}

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
        name: u.name, kind: u.kind, submitted: !!u.submitted, exempt: u.status === 'exempt',
        gi: c.gi, gn: c.gn, con: c.gi - c.gn, tl: pc(c.gn, c.gi),
        giam: p.gn > 0 && c.gn < p.gn - 0.0001
      };
    })
    .filter(function (r) { return r.gi > 0; });
  return { key: key, progLabel: prog ? prog.label : 'Tổng các nguồn', rows: rows };
}

/* ---------- thống kê theo từng nguồn vốn ---------- */
function sourceStats(scope) {
  return (PROGRAMS || []).filter(function (p) { return p.key !== 'all'; }).map(function (p) {
    var gi = 0, gn = 0;
    (state.units || []).forEach(function (u) {
      if (!inScope(u, scope)) return;
      var c = pick(u, p.key); gi += c.gi; gn += c.gn;
    });
    return { label: p.label, gi: gi, gn: gn, tl: pc(gn, gi) };
  }).filter(function (x) { return x.gi > 0; });
}

/* ---------- biểu đồ SVG ---------- */
function barsBySource(scope) {
  var list = sourceStats(scope);

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
         '<td class="c">' + (r.submitted ? '<span class="ok">✓</span>' : r.exempt ? '<span class="ok" title="Đã giải ngân 100%, không phải gửi">100%</span>' : '<span class="no">–</span>') + '</td></tr>';
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
/* ---------- kiến nghị, đôn đốc (lời văn của Sở Tài chính) ----------
   Căn cứ: CV 4099/UBND-TH ngày 22/10/2026 và CV 4055/UBND-KT ngày 20/10/2026 của UBND tỉnh.
   Không tự đặt ngưỡng tỷ lệ; mốc so sánh lấy từ tiến độ thời gian và bình quân toàn tỉnh. */
function kienNghiBox(mode) {
  var it = [];
  it.push('Rà soát từng nhiệm vụ, dự án được giao dự toán; xác định rõ nguyên nhân chậm, trách nhiệm của đơn vị và cá nhân phụ trách; xây dựng tiến độ giải ngân cụ thể theo từng nhiệm vụ, phấn đấu hoàn thành kế hoạch vốn được giao.');
  it.push('Tập trung chỉ đạo, đôn đốc nhà thầu đẩy nhanh tiến độ thi công; tổ chức nghiệm thu, hoàn thiện hồ sơ và thanh toán ngay khi có khối lượng hoàn thành, không để dồn vào cuối năm.');
  if (mode === 'baolu') {
    it.push('Đơn vị chưa lựa chọn xong nhà thầu khẩn trương hoàn thành thủ tục đấu thầu, khởi công; chủ động xử lý vướng mắc thuộc thẩm quyền, khó khăn vượt thẩm quyền thì tổng hợp rõ nội dung, cơ quan có trách nhiệm xử lý và kiến nghị cấp có thẩm quyền xem xét.');
  } else {
    it.push('Đối với vốn các Chương trình mục tiêu quốc gia: tăng cường kiểm tra, đôn đốc chủ đầu tư và đơn vị thực hiện; khẩn trương hoàn thiện thủ tục, hồ sơ thanh toán và xử lý vướng mắc thuộc thẩm quyền; khó khăn vượt thẩm quyền thì tổng hợp rõ nội dung, cơ quan có trách nhiệm xử lý và kiến nghị cấp có thẩm quyền xem xét.');
  }
  it.push('Đối với nguồn vốn, nhiệm vụ đến thời điểm báo cáo chưa phát sinh giải ngân: xác định rõ nguyên nhân, trách nhiệm, các bước còn phải hoàn thành và dự kiến thời điểm giải ngân, báo cáo về Sở Tài chính.');
  it.push('Đối với công trình, nhiệm vụ chi xác định không thể giải ngân hết trong năm 2026: báo cáo bằng văn bản về Sở Tài chính, nêu rõ số kinh phí, nguyên nhân và đề xuất xử lý để Sở Tài chính tham mưu Ủy ban nhân dân tỉnh điều chuyển.');
  it.push('Cập nhật đầy đủ, kịp thời số liệu trên hệ thống theo đúng thời hạn từng kỳ; chịu trách nhiệm trước Ủy ban nhân dân tỉnh về tính chính xác, trung thực của số liệu đã nhập.');
  var h = '<div class="row"><div class="box" style="flex:1"><div class="t">Kiến nghị, đôn đốc đối với đơn vị giải ngân chậm</div><div class="note">';
  h += 'Thực hiện Công văn số 4099/UBND-TH ngày 22/10/2026 và Công văn số 4055/UBND-KT ngày 20/10/2026 của Ủy ban nhân dân tỉnh, Sở Tài chính đề nghị các đơn vị:<br>';
  it.forEach(function (x, i) { h += (i + 1) + '. ' + x + '<br>'; });
  h += 'Sở Tài chính tiếp tục theo dõi, tổng hợp tiến độ giải ngân của từng đơn vị và định kỳ báo cáo Ủy ban nhân dân tỉnh; kính đề nghị Ủy ban nhân dân tỉnh xem xét biểu dương đơn vị giải ngân tốt, phê bình đơn vị giải ngân chậm, không có chuyển biến qua các kỳ.';
  return h + '</div></div></div>';
}

function baoLuSummaryBox(scope) {
  var rows = baoLuRows().filter(function (r) { return inScope(r, scope); });
  if (!rows.length) return '';
  var gi = 0, gn = 0, dt = 0, tx = 0, prj = 0, ctr = 0;
  rows.forEach(function (r) { gi += r.gi; gn += r.gn; dt += r.dt; tx += r.tx; prj += r.projects; ctr += r.contracted; });
  var duoiTD = rows.filter(function (r) { return r.tl < timePct(); });
  return '<div class="row"><div class="box" style="flex:1">' +
    '<div class="t">Mục VI · Kinh phí bão lũ nguồn NSTW giao trong năm (theo dõi riêng, không tính vào các số liệu trên)</div>' +
    '<div class="note">' +
    'Vốn NSTW giao <b>' + n0(gi) + ' ' + UNIT_TXT + '</b> cho ' + rows.length + ' đơn vị; đã thanh toán <b>' + n0(gn) +
    ' ' + UNIT_TXT + '</b>, đạt <b>' + pcTxt(pc(gn, gi)) + '</b>; còn lại <b>' + n0(gi - gn) + ' ' + UNIT_TXT + '</b>' +
    ' (chi đầu tư ' + n0(dt) + ', chi thường xuyên ' + n0(tx) + ').<br>' +
    'Công trình đã lựa chọn xong nhà thầu: <b>' + ctr + '/' + prj + '</b>; có <b>' + duoiTD.length + '/' + rows.length +
    ' đơn vị</b> thanh toán thấp hơn tiến độ thời gian. Chi tiết tại báo cáo riêng "Mục VI – Kinh phí bão lũ".' +
    '</div></div></div>';
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
  var notSent = rows.filter(function (r) { return !r.submitted && !r.exempt; });
  var giam = rows.filter(function (r) { return r.giam; });
  var per0 = state.period || {};
  var closed = !!per0.closed;
  var nhac = remindNotSent();

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
    '<div><div class="k">Nộp báo cáo</div><div class="v">' + sent + '/' + rows.filter(function (r) { return r.submitted || !r.exempt; }).length + '</div><div class="n">' +
      (nhac ? notSent.length + ' đơn vị chưa gửi' : 'đã gửi đến thời điểm báo cáo') + '</div></div>' +
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
  var tpc = timePct();
  var duoiTD = rows.filter(function (r) { return r.tl < tpc; });
  var chuaPS = rows.filter(function (r) { return r.gn <= 0; });
  h += '2. So với tiến độ thời gian (' + pcTxt(tpc) + '): <b>' + duoiTD.length + '/' + rows.length +
       ' đơn vị</b> có tỷ lệ giải ngân thấp hơn tiến độ' +
       (chuaPS.length ? ', trong đó <b>' + chuaPS.length + ' đơn vị chưa phát sinh giải ngân</b> (' +
         esc2(chuaPS.slice(0, 10).map(function (r) { return r.name; }).join('; ')) + (chuaPS.length > 10 ? '…' : '') + ')' : '') +
       '. Đề nghị rà soát từng nhiệm vụ, dự án, xác định nguyên nhân, trách nhiệm và thời hạn khắc phục.<br>';
  var low = sourceStats(scope).filter(function (x) { return x.tl < tl; })
            .sort(function (a, b) { return a.tl - b.tl; });
  var i = 3;
  if (low.length) {
    h += i++ + '. Xét theo từng nguồn vốn, tỷ lệ giải ngân thấp hơn mức chung tập trung ở: ' +
      esc2(low.map(function (x) { return x.label + ' (' + pcTxt(x.tl) + ')'; }).join('; ')) + '.<br>';
  }
  if (giam.length) {
    h += i++ + '. <span class="warn">Số liệu giảm so với kỳ trước</span> tại ' + giam.length + ' đơn vị: ' +
      esc2(giam.slice(0, 12).map(function (r) { return r.name; }).join('; ')) + (giam.length > 12 ? '…' : '') + '. Đề nghị các đơn vị giải trình.<br>';
  }
  if (nhac && notSent.length) {
    h += i++ + '. <b>Chưa gửi báo cáo kỳ này (' + notSent.length + '):</b> ' +
      esc2(notSent.map(function (r) { return r.name; }).join('; ')) + '.<br>';
  } else if (!closed) {
    h += i++ + '. Kỳ báo cáo chưa đến hạn chốt' + (per0.cutoffText ? ' (' + esc2(per0.cutoffText) + ')' : '') +
      ', các đơn vị đang trong thời gian cập nhật, gửi số liệu.<br>';
  }
  h += '<i>Các đơn vị chịu trách nhiệm trước Ủy ban nhân dân tỉnh về tính chính xác, trung thực của số liệu đã nhập.</i>';
  h += '</div></div></div>';

  h += baoLuSummaryBox(scope);
  h += kienNghiBox('all');
  h += signBlock();
  h += '<div class="foot">Nguồn: Hệ thống theo dõi giải ngân vốn thường xuyên – Sở Tài chính tỉnh Cao Bằng. Ký hiệu: ▼ số liệu giảm so với kỳ trước; ✓ đã gửi báo cáo.</div>';

  if (AI_HTML) h += '<div class="pb"><div class="sec">Nhận định và đề xuất chuyên sâu (AI hỗ trợ)</div>' + AI_HTML + '</div>';

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
  var tpcB = timePct();
  var duoiTDB = rows.filter(function (r) { return r.tl < tpcB; });
  var chuaPSB = rows.filter(function (r) { return r.gn <= 0; });
  h += '2. So với tiến độ thời gian (' + pcTxt(tpcB) + '): <b>' + duoiTDB.length + '/' + rows.length +
       ' đơn vị</b> thanh toán thấp hơn tiến độ' +
       (chuaPSB.length ? ', trong đó <b>' + chuaPSB.length + ' đơn vị chưa phát sinh thanh toán</b> (' +
         esc2(chuaPSB.slice(0, 10).map(function (r) { return r.name; }).join('; ')) + (chuaPSB.length > 10 ? '…' : '') + ')' : '') +
       '. Đề nghị khẩn trương hoàn thiện thủ tục nghiệm thu, hồ sơ thanh toán.<br>';
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
function printDoc(html, pre) {
  var w = pre || window.open('', '_blank');
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

function printLeaderReport(scope, useAi) {
  scope = scope || 'all';
  if (scope === 'baolu' || !useAi || !window.gnAI) {
    AI_HTML = '';
    printDoc(scope === 'baolu' ? buildBaoLuDoc() : buildLeaderDoc(scope));
    return;
  }
  var w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(window.gnAI.loadingPage()); w.document.close(); }
  var D = collect(scope), per = state.period || {};
  window.gnAI.assess({ kind: 'lanhdao', title: 'Báo cáo lãnh đạo – ' + scopeText(scope), period: per.label || '', timePct: timePct(), rows: D.rows,
    sources: sourceStats(scope).map(function (x) { return { ten: x.label, tyLe: Math.round((Number(x.tl) || 0) * 10) / 10 }; }) })
    .then(function (text) { AI_HTML = window.gnAI.box(text); },
          function (err) { AI_HTML = ''; alert('Chưa tạo được phần AI hỗ trợ: ' + ((err && err.message) || 'lỗi không xác định') + '\nBáo cáo vẫn được lập, không có phần này.'); })
    .then(function () { var html = buildLeaderDoc(scope); AI_HTML = ''; printDoc(html, w); });
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

  var aiRow = document.createElement('label');
  aiRow.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin:0 0 10px;padding:8px 10px;border:1px solid #bcd9cb;border-radius:8px;background:#f1f8f4;font-size:12px;line-height:1.35;cursor:pointer';
  aiRow.innerHTML = '<input type="checkbox" id="leaderAiChk" style="margin-top:2px"><span><b style="color:#0b6b4f">Thêm phần nhận định, đề xuất do AI hỗ trợ</b><br><span style="color:#6b7280">AI đọc số liệu các kỳ và soạn nhận định, giải pháp, nhắc nhở. Chờ khoảng 20–60 giây. Không áp dụng cho Mục VI.</span></span>';
  card.appendChild(aiRow);

  SCOPES.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button';
    b.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:8px;padding:9px 11px;border:1px solid #d7dce3;border-radius:8px;background:#fafbfc;cursor:pointer;font-size:13px;line-height:1.3';
    b.innerHTML = '<span style="font-weight:700;color:#1e3a5f">' + s.label + '</span><br><span style="font-size:11px;color:#6b7280">' + s.note + '</span>';
    b.addEventListener('mouseenter', function () { b.style.background = '#eef2f7'; });
    b.addEventListener('mouseleave', function () { b.style.background = '#fafbfc'; });
    b.addEventListener('click', function () { var ai = !!(document.getElementById('leaderAiChk') && document.getElementById('leaderAiChk').checked); wrap.remove(); printLeaderReport(s.key, ai); });
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

var AI_HTML = '';
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
      name: u.name, kind: u.kind, submitted: !!u.submitted, exempt: u.status === 'exempt',
      gi: gi, gn: gn, con: gi - gn, tl: pc(gn, gi),
      delta: pc(gn, gi) - ptl,
      giam: (Number(b[1]) || 0) > 0 && gn < (Number(b[1]) || 0) - 0.0001,
      leader: leaderOf(u.name),
      src: srcOf(u), mtqg: u.mtqg || {}, pgnAll: state.prevAt && u.prev && u.prev.all ? Number(u.prev.all[1]) || 0 : null
    };
  }).filter(function (r) { return r.gi > 0; });
}

/* Số liệu từng nguồn vốn của một đơn vị (I–V): [dự toán, đã giải ngân] */
var SRC_LABELS = [
  ['I', 'I. Dự toán đầu năm'],
  ['II', 'II. Chương trình mục tiêu quốc gia'],
  ['III', 'III. Bổ sung có mục tiêu'],
  ['IV', 'IV. Sự nghiệp khoa học công nghệ (NQ 57-NQ/TW)'],
  ['V', 'V. Dự phòng ngân sách']
];
function srcOf(u) {
  var out = [];
  SRC_LABELS.forEach(function (x) {
    var a = (u.p || {})[x[0]];
    if (!a) return;
    var gi = Number(a[0]) || 0, gn = Number(a[1]) || 0;
    if (gi === 0 && gn === 0) return;
    var pv = (u.prev || {})[x[0]];
    out.push({ key: x[0], label: x[1], gi: gi, gn: gn, con: gi - gn, tl: pc(gn, gi), pgn: state.prevAt && pv ? Number(pv[1]) || 0 : null });
  });
  return out;
}

function timePct() {
  var now = new Date(), y = now.getFullYear();
  var start = new Date(y, 0, 1), end = new Date(y + 1, 0, 1);
  return (now - start) / (end - start) * 100;
}

function remindNotSent() {
  var k = (state.period || {}).key;
  if (!k) return false;
  var a = k.split('-');
  if (a.length !== 3) return false;
  var d0 = new Date(+a[0], +a[1] - 1, +a[2]);
  var now = new Date();
  var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t0 - d0) / 86400000) === 1;
}

/* biểu đồ thanh: tỷ lệ từng đơn vị + mốc bình quân tỉnh + mốc tiến độ thời gian */
function barsQuick(rows, avg, tpc, lbl) {
  var dense = rows.length > 26;
  var H = dense ? 10.6 : 17, W = 460, LBL = 168, BW = W - LBL - 40;
  var FS = dense ? 7.4 : 7.8, BH = dense ? 6.6 : 9, BY = dense ? 1.9 : 2, TY = dense ? 7.2 : 9;
  var x0 = function (p) { return LBL + BW * Math.min(Math.max(p, 0), 100) / 100; };
  var svg = '<svg viewBox="0 0 ' + W + ' ' + (rows.length * H + 22) + '" width="100%"' + (dense ? ' style="max-height:228mm"' : '') + '>';
  rows.forEach(function (r, i) {
    var y = i * H + 4, w = Math.max(1.5, BW * Math.min(r.tl, 100) / 100);
    var col = r.tl < avg ? '#c0392b' : r.tl < 90 ? '#2d7dd2' : '#1e8449';
    svg += '<text x="0" y="' + (y + TY) + '" font-size="' + FS + '" fill="#1f2937">' + esc2(r.name) + '</text>';
    svg += '<rect x="' + LBL + '" y="' + (y + BY) + '" width="' + BW + '" height="' + BH + '" rx="2" fill="#e8ebef"/>';
    svg += '<rect x="' + LBL + '" y="' + (y + BY) + '" width="' + w + '" height="' + BH + '" rx="2" fill="' + col + '"/>';
    svg += '<text x="' + (LBL + BW + 3) + '" y="' + (y + TY + .4) + '" font-size="' + FS + '" font-weight="700" fill="' + col + '">' + pcTxt(r.tl) + '</text>';
  });
  var hTot = rows.length * H + 2;
  svg += '<line x1="' + x0(avg) + '" y1="2" x2="' + x0(avg) + '" y2="' + hTot + '" stroke="#1e3a5f" stroke-width="1" stroke-dasharray="3 2"/>';
  svg += '<line x1="' + x0(tpc) + '" y1="2" x2="' + x0(tpc) + '" y2="' + hTot + '" stroke="#d68910" stroke-width="1" stroke-dasharray="1 2"/>';
  svg += '<text x="' + LBL + '" y="' + (hTot + 14) + '" font-size="7.2" fill="#1e3a5f">--- ' + (lbl || 'Bình quân tỉnh') + ' ' + pcTxt(avg) + '</text>';
  svg += '<text x="' + (LBL + 120) + '" y="' + (hTot + 14) + '" font-size="7.2" fill="#d68910">··· Tiến độ thời gian ' + pcTxt(tpc) + '</text>';
  return svg + '</svg>';
}

/* ---------- kiến nghị, đôn đốc (lời văn của Sở Tài chính) ----------
   Căn cứ: CV 4099/UBND-TH ngày 22/10/2026 và CV 4055/UBND-KT ngày 20/10/2026 của UBND tỉnh.
   Không tự đặt ngưỡng tỷ lệ; mốc so sánh lấy từ tiến độ thời gian và bình quân toàn tỉnh. */
function kienNghiBox(mode) {
  var it = [];
  it.push('Rà soát từng nhiệm vụ, dự án được giao dự toán; xác định rõ nguyên nhân chậm, trách nhiệm của đơn vị và cá nhân phụ trách; xây dựng tiến độ giải ngân cụ thể theo từng nhiệm vụ, phấn đấu hoàn thành kế hoạch vốn được giao.');
  it.push('Tập trung chỉ đạo, đôn đốc nhà thầu đẩy nhanh tiến độ thi công; tổ chức nghiệm thu, hoàn thiện hồ sơ và thanh toán ngay khi có khối lượng hoàn thành, không để dồn vào cuối năm.');
  if (mode === 'baolu') {
    it.push('Đơn vị chưa lựa chọn xong nhà thầu khẩn trương hoàn thành thủ tục đấu thầu, khởi công; chủ động xử lý vướng mắc thuộc thẩm quyền, khó khăn vượt thẩm quyền thì tổng hợp rõ nội dung, cơ quan có trách nhiệm xử lý và kiến nghị cấp có thẩm quyền xem xét.');
  } else {
    it.push('Đối với vốn các Chương trình mục tiêu quốc gia: tăng cường kiểm tra, đôn đốc chủ đầu tư và đơn vị thực hiện; khẩn trương hoàn thiện thủ tục, hồ sơ thanh toán và xử lý vướng mắc thuộc thẩm quyền; khó khăn vượt thẩm quyền thì tổng hợp rõ nội dung, cơ quan có trách nhiệm xử lý và kiến nghị cấp có thẩm quyền xem xét.');
  }
  it.push('Đối với nguồn vốn, nhiệm vụ đến thời điểm báo cáo chưa phát sinh giải ngân: xác định rõ nguyên nhân, trách nhiệm, các bước còn phải hoàn thành và dự kiến thời điểm giải ngân, báo cáo về Sở Tài chính.');
  it.push('Đối với công trình, nhiệm vụ chi xác định không thể giải ngân hết trong năm 2026: báo cáo bằng văn bản về Sở Tài chính, nêu rõ số kinh phí, nguyên nhân và đề xuất xử lý để Sở Tài chính tham mưu Ủy ban nhân dân tỉnh điều chuyển.');
  it.push('Cập nhật đầy đủ, kịp thời số liệu trên hệ thống theo đúng thời hạn từng kỳ; chịu trách nhiệm trước Ủy ban nhân dân tỉnh về tính chính xác, trung thực của số liệu đã nhập.');
  var h = '<div class="row"><div class="box" style="flex:1"><div class="t">Kiến nghị, đôn đốc đối với đơn vị giải ngân chậm</div><div class="note">';
  h += 'Thực hiện Công văn số 4099/UBND-TH ngày 22/10/2026 và Công văn số 4055/UBND-KT ngày 20/10/2026 của Ủy ban nhân dân tỉnh, Sở Tài chính đề nghị các đơn vị:<br>';
  it.forEach(function (x, i) { h += (i + 1) + '. ' + x + '<br>'; });
  h += 'Sở Tài chính tiếp tục theo dõi, tổng hợp tiến độ giải ngân của từng đơn vị và định kỳ báo cáo Ủy ban nhân dân tỉnh; kính đề nghị Ủy ban nhân dân tỉnh xem xét biểu dương đơn vị giải ngân tốt, phê bình đơn vị giải ngân chậm, không có chuyển biến qua các kỳ.';
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
         '<td class="c">' + (r.submitted ? '<span class="ok">✓</span>' : r.exempt ? '<span class="ok" title="Đã giải ngân 100%, không phải gửi">100%</span>' : '<span class="no">–</span>') + '</td>' +
         '<td>' + esc2(r.leader || '—') + '</td></tr>';
  });
  return h + '</tbody></table>';
}

/* Chi tiết từng nguồn vốn của từng đơn vị — mỗi đơn vị một khối, không giới hạn số trang */
function quickBySource(rows, bqSrc, bqk) {
  /* Mẫu báo cáo Tĩnh Túc: mỗi nguồn có bình quân của chính nguồn đó và mức tăng/giảm so kỳ trước; vốn MTQG chi tiết từng chương trình. */
  var MTN = { '1': 'CTMTQG xây dựng NTM, giảm nghèo bền vững và phát triển KT-XH vùng ĐBDTTS&MN', '2': 'CTMTQG về phát triển văn hóa', '3': 'CTMTQG phòng, chống ma túy' };
  var hasPrev = !!state.prevAt;
  function dl(cur, prev) { if (!hasPrev || prev == null) return '—'; var d = cur - prev; return Math.abs(d) < 0.5 ? '0' : (d > 0 ? '+' : '−') + n0(Math.abs(d)); }
  function dc(cur, prev) { return hasPrev && prev != null && cur < prev - 0.5 ? ' lo' : ''; }
  var h = '';
  rows.forEach(function (r, i) {
    var cls = r.tl < 50 ? 'lo' : r.tl >= 90 ? 'hi' : '';
    h += '<table class="t-src"><thead>' +
         '<tr class="uh"><th colspan="7">' + (i + 1) + '. ' + esc2(r.name) +
           ' <span class="uh-s">· Tổng: ' + n0(r.gn) + ' / ' + n0(r.gi) + ' · <span class="' + cls + '">' + pcTxt(r.tl) + '</span>' +
           (r.leader ? ' · Lãnh đạo: ' + esc2(r.leader) : '') + '</span></th></tr>' +
         '<tr class="ch"><th>Nguồn vốn</th><th class="r">Dự toán</th><th class="r">Đã giải ngân</th><th class="r">Còn lại</th><th class="r">Tỷ lệ</th><th class="r">' + esc2(bqk || 'Bình quân') + '</th><th class="r">Tăng/giảm so ' + (hasPrev ? 'mốc ' + esc2(state.prevAt) : 'kỳ trước') + '</th></tr>' +
         '</thead><tbody>';
    if (!r.src.length) {
      h += '<tr><td colspan="7" class="c">Chưa có số liệu theo nguồn vốn</td></tr>';
    } else {
      r.src.forEach(function (x) {
        var c = x.gi <= 0 || x.key === 'V' ? '' : x.tl < 50 ? 'lo' : x.tl >= 90 ? 'hi' : '';
        var bq = bqSrc ? bqSrc[x.key] : null;
        h += '<tr><td>' + esc2(x.label) + '</td><td class="r">' + n0(x.gi) + '</td><td class="r">' + n0(x.gn) + '</td>' +
             '<td class="r">' + n0(x.con) + '</td><td class="r b ' + c + '">' + (x.gi > 0 ? pcTxt(x.tl) : '—') + '</td>' +
             '<td class="r">' + (bq == null ? '—' : pcTxt(bq)) + '</td><td class="r' + dc(x.gn, x.pgn) + '">' + dl(x.gn, x.pgn) + '</td></tr>';
        if (x.key === 'II') Object.keys(r.mtqg || {}).sort().forEach(function (k) {
          var a = r.mtqg[k]; if (!a || !(Number(a[0]) > 0)) return;
          var t = pc(Number(a[1]) || 0, Number(a[0]));
          h += '<tr class="sub"><td>– ' + esc2(MTN[k] || 'Chương trình mã ' + k) + '</td><td class="r">' + n0(a[0]) + '</td><td class="r">' + n0(a[1]) + '</td>' +
               '<td class="r">' + n0(a[0] - a[1]) + '</td><td class="r b' + (t <= 0 ? ' lo' : '') + '">' + pcTxt(t) + '</td><td></td><td></td></tr>';
        });
      });
      h += '<tr class="tot"><td>Tổng cộng</td><td class="r">' + n0(r.gi) + '</td><td class="r">' + n0(r.gn) + '</td><td class="r">' + n0(r.con) + '</td>' +
           '<td class="r">' + pcTxt(r.tl) + '</td><td class="r"></td><td class="r' + dc(r.gn, r.pgnAll) + '">' + dl(r.gn, r.pgnAll) + '</td></tr>';
    }
    h += '</tbody></table>';
  });
  if (rows.length) h += '<div class="foot" style="margin-top:-4px">Mục V Dự phòng ngân sách là nguồn dự trữ, không bắt buộc giải ngân hết nên không tô màu cảnh báo.</div>';
  return h;
}

function buildQuickHtml(picked) {
  var all = allRows();
  var set = {}; picked.forEach(function (n) { set[n] = 1; });
  var rows = all.filter(function (r) { return set[r.name]; }).sort(function (a, b) { return a.tl - b.tl; });

  var xaOnly = rows.length > 0 && rows.every(function (r) { return r.kind === 'commune'; });
  var baseRows = xaOnly ? all.filter(function (r) { return r.kind === 'commune'; }) : all;
  var BQL = xaOnly ? 'bình quân ' + baseRows.length + ' xã, phường' : 'bình quân tỉnh', BQK = xaOnly ? 'BQ ' + baseRows.length + ' xã, phường' : 'Bình quân tỉnh';
  var tGi = 0, tGn = 0; baseRows.forEach(function (r) { tGi += r.gi; tGn += r.gn; });
  var avg = pc(tGn, tGi);
  var bqSrc = {}; SRC_LABELS.forEach(function (x) { var p = 0, d = 0; baseRows.forEach(function (r) { r.src.forEach(function (y) { if (y.key === x[0]) { p += y.gi; d += y.gn; } }); }); bqSrc[x[0]] = p > 0 ? pc(d, p) : null; });
  var gi = 0, gn = 0; rows.forEach(function (r) { gi += r.gi; gn += r.gn; });
  var tl = pc(gn, gi), tpc = timePct();

  var duoiBQ = rows.filter(function (r) { return r.tl < avg; });
  var giam = rows.filter(function (r) { return r.giam; });
  var chuaGui = rows.filter(function (r) { return !r.submitted && !r.exempt; });
  var per = state.period || {};
  var closed = !!per.closed;
  var nhac = remindNotSent();

  var ld = rows.length && rows[0].leader && rows.every(function (r) { return r.leader === rows[0].leader; })
           ? rows[0].leader : '';
  var sub = '<b>Kỳ báo cáo: ' + esc2(per.label || '—') + '</b>' +
            (per.cutoffText ? ' · Chốt số liệu: ' + esc2(per.cutoffText) : '') +
            ' · ' + rows.length + ' đơn vị được chọn' +
            (ld ? ' · Lãnh đạo UBND tỉnh phụ trách: đ/c ' + esc2(ld) : '') +
            ' · Đơn vị tính: triệu đồng';

  var h = '<div class="noprint bar"><button onclick="window.print()">In báo cáo</button>' +
          '<span>Báo cáo hiển thị trực tiếp, không cần tải file. Khi in, bỏ chọn "Headers and footers".</span></div>';

  h += '<div class="hd"><div class="org">Ủy ban nhân dân tỉnh Cao Bằng · Sở Tài chính</div>' +
       '<h1>Báo cáo nhanh tình hình giải ngân vốn thường xuyên</h1><div class="sub">' + sub + '</div></div>';

  h += '<div class="kpi">' +
    '<div><div class="k">Dự toán nhóm</div><div class="v">' + n0(gi) + '</div><div class="n">' + rows.length + ' đơn vị</div></div>' +
    '<div><div class="k">Đã giải ngân</div><div class="v">' + n0(gn) + '</div><div class="n">lũy kế đến kỳ báo cáo</div></div>' +
    '<div><div class="k">Tỷ lệ nhóm</div><div class="v big">' + pcTxt(tl) + '</div><div class="n">' + (tl >= avg ? 'cao hơn' : 'thấp hơn') + ' ' + BQL + '</div></div>' +
    '<div><div class="k">' + BQK + '</div><div class="v">' + pcTxt(avg) + '</div><div class="n">tiến độ thời gian ' + pcTxt(tpc) + '</div></div>' +
    '<div><div class="k">Nộp báo cáo</div><div class="v">' + rows.filter(function (r) { return r.submitted; }).length + '/' + rows.filter(function (r) { return r.submitted || !r.exempt; }).length + '</div><div class="n">' +
      (nhac ? chuaGui.length + ' đơn vị chưa gửi' : 'đã gửi đến thời điểm báo cáo') + '</div></div>' +
    '</div>';

  var chartHtml = '<div class="row"><div class="box" style="flex:1"><div class="t">Tỷ lệ giải ngân từng đơn vị (xếp theo tỷ lệ từ thấp đến cao)</div>' +
         barsQuick(rows, avg, tpc, BQK) + '</div></div>';
  if (rows.length <= 26) h += chartHtml;

  h += '<div class="row"><div class="box" style="flex:1"><div class="t">Nhận xét, đề nghị</div><div class="note">';
  h += '1. Tổng dự toán của ' + rows.length + ' đơn vị là <b>' + n0(gi) + ' triệu đồng</b>, đã giải ngân <b>' + n0(gn) +
       ' triệu đồng</b>, đạt <b>' + pcTxt(tl) + '</b>, ' + (tl >= avg ? 'cao hơn' : 'thấp hơn') + ' ' + BQL + ' (' + pcTxt(avg) +
       ') và ' + (tl >= tpc ? 'bảo đảm' : 'chậm so với') + ' tiến độ thời gian (' + pcTxt(tpc) + ').<br>';
  var i = 2;
  h += i++ + '. Thấp hơn ' + BQL + ': ' + (duoiBQ.length ? '<b>' + duoiBQ.length + ' đơn vị</b> – ' +
       esc2(duoiBQ.map(function (r) { return r.name + ' (' + pcTxt(r.tl) + ')'; }).join('; ')) +
       '. Đề nghị đẩy nhanh giải ngân, lập danh sách phần kinh phí còn lại và nêu rõ thời điểm dự kiến giải ngân.'
       : 'không có đơn vị nào.') + '<br>';
  var chuaPS = rows.filter(function (r) { return r.gn <= 0; });
  if (chuaPS.length) {
    h += i++ + '. <b>Chưa phát sinh giải ngân</b> đến thời điểm báo cáo: ' +
         esc2(chuaPS.map(function (r) { return r.name; }).join('; ')) +
         '. Đề nghị xác định rõ nguyên nhân, trách nhiệm, các bước còn phải hoàn thành và dự kiến thời điểm giải ngân.<br>';
  }
  if (giam.length) {
    h += i++ + '. <span class="warn">Số giải ngân giảm so với kỳ trước</span> tại ' + giam.length + ' đơn vị: ' +
         esc2(giam.map(function (r) { return r.name; }).join('; ')) + '. Đề nghị giải trình nguyên nhân và biện pháp khắc phục.<br>';
  }
  if (nhac && chuaGui.length) {
    h += i++ + '. Chưa gửi báo cáo kỳ ' + esc2(per.label || '') + ': <b>' + esc2(chuaGui.map(function (r) { return r.name; }).join('; ')) +
         '</b>. Đề nghị khẩn trương cập nhật và gửi báo cáo đúng thời hạn.<br>';
  } else if (!closed) {
    h += i++ + '. Kỳ báo cáo chưa đến hạn chốt' + (per.cutoffText ? ' (' + esc2(per.cutoffText) + ')' : '') +
         ', các đơn vị đang trong thời gian cập nhật, gửi số liệu.<br>';
  }
  h += i++ + '. Đề nghị các đơn vị tiếp tục theo dõi, cập nhật tiến độ theo kỳ và có kế hoạch giải ngân cụ thể đến 31/12/2026.<br>';
  h += '<i>Các đơn vị chịu trách nhiệm trước Ủy ban nhân dân tỉnh về tính chính xác, trung thực của số liệu đã nhập.</i>';
  h += '</div></div></div>';

  h += AI_HTML;
  h += kienNghiBox('all');
  if (rows.length > 26) h += '<div class="pb"></div>' + chartHtml;

  var few = rows.length <= 12;
  h += (few ? '' : '<div class="pb"></div>') + '<div style="margin-top:8px;' + (few ? 'page-break-inside:avoid;break-inside:avoid' : '') + '"><div class="sec">Chi tiết từng đơn vị (xếp theo tỷ lệ từ thấp đến cao)</div>' +
       quickDetail(rows) + '</div>';

  h += (few ? '' : '<div class="pb"></div>') + '<div class="sec" style="margin-top:10px">Chi tiết từng nguồn vốn của từng đơn vị (đơn vị tính: triệu đồng)</div>' +
       quickBySource(rows, bqSrc, BQK);

  h += '<div class="foot">Nguồn: Hệ thống theo dõi giải ngân vốn thường xuyên – Sở Tài chính tỉnh Cao Bằng. ' +
       'Cột "So kỳ trước" tính bằng điểm phần trăm tỷ lệ giải ngân.</div>';

  var css = BASE_CSS +
    '@page{size:A4 portrait;margin:12mm 11mm}' +
    'body{font-size:12.5px;line-height:1.45}' +
    '.hd .org{font-size:12px}.hd h1{font-size:19px}.hd .sub{font-size:11.5px}' +
    '.kpi .k{font-size:9.5px}.kpi .v{font-size:17px}.kpi .n{font-size:9.5px}' +
    '.box>.t{font-size:11px}.note{font-size:11.5px;line-height:1.55}' +
    '.sec{font-size:12.5px;margin:8px 0 6px}' +
    '.t-det{font-size:10.5px}.t-det th{font-size:10px;padding:4px 4px}.t-det td{padding:3px 4px}' +
    '.t-det tr,.t-src tr{page-break-inside:avoid}.t-det thead{display:table-header-group}' +
    '.t-src{width:100%;border-collapse:collapse;font-size:11.5px;margin:0 0 10px;page-break-inside:avoid;break-inside:avoid}' +
    '.t-src th{padding:3px 6px;text-align:left}' +
    '.t-src .uh th{background:#1e3a5f;color:#fff;font-size:12px}' +
    '.t-src .uh-s{font-weight:400;font-size:11px}' +
    '.t-src .uh-s .lo,.t-src .uh-s .hi{background:#fff;padding:0 4px;border-radius:3px;font-weight:700}' +
    '.t-src .ch th{background:#e8edf3;color:#1e3a5f;font-size:10.5px}' +
    '.t-src .ch th.r{text-align:right}' +
    '.t-src th:first-child,.t-src td:first-child{width:36%}' +
    '.t-src tr.sub td{font-size:10.5px;color:#374151;padding-left:14px}.t-src tr.tot td{font-weight:700;background:#fff4dd}' +
    '.t-src td.c{text-align:center;color:#6b7280}' +
    '.sec{page-break-after:avoid;break-after:avoid}' +
    '.t-det td{padding:3.5px 4px}' +
    '.t-src td{padding:3px 6px;border-bottom:.5px solid #d7dce3}' +
    '.foot{font-size:10px}.sign div{font-size:11px}' +
    '@media screen{body{background:#eef1f5;padding:14px 0}' +
      '.doc{background:#fff;width:210mm;max-width:96vw;margin:0 auto;padding:10mm 9mm;box-shadow:0 3px 16px rgba(0,0,0,.14)}}' +
    '.bar{background:#1e3a5f;color:#fff;padding:7px 10px;margin:-10mm -9mm 8px;font-size:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
    '.bar button{padding:5px 14px;border:0;border-radius:6px;background:#fff;color:#1e3a5f;font-weight:700;cursor:pointer}' +
    '@media print{.noprint{display:none!important}}';

  return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo nhanh – Kỳ ' + esc2(per.label || '') +
         '</title><style>' + css + '</style></head><body><div class="doc">' + h + '</div></body></html>';
}

function showQuick(picked, useAi) {
  if (useAi && window.gnAI) {
    var w0 = window.open('', '_blank');
    if (w0) { w0.document.open(); w0.document.write(window.gnAI.loadingPage()); w0.document.close(); }
    var set = {}; picked.forEach(function (n) { set[n] = 1; });
    var rows0 = allRows().filter(function (r) { return set[r.name]; }), per0 = state.period || {};
    window.gnAI.assess({ kind: 'nhanh', title: 'Báo cáo nhanh – nhóm ' + rows0.length + ' đơn vị được chọn', period: (per0.label || '') + (per0.closed ? ' (số liệu đã chốt)' : ' (số liệu tạm tính, kỳ chưa chốt)'), timePct: timePct(), sources: quickSourcesV2(picked, Math.round(timePct() * 10) / 10), rows: rows0 })
      .then(function (text) { AI_HTML = window.gnAI.box(text); },
            function (err) { AI_HTML = ''; alert('Chưa tạo được phần AI hỗ trợ: ' + ((err && err.message) || 'lỗi không xác định') + '\nBáo cáo vẫn được lập, không có phần này.'); })
      .then(function () {
        var h0 = buildQuickHtml(picked); AI_HTML = '';
        if (w0) { w0.document.open(); w0.document.write(h0); w0.document.close(); try { w0.focus(); } catch (e) {} }
        else alert('Trình duyệt đang chặn cửa sổ mới. Hãy cho phép pop-up cho trang này rồi bấm lại.');
      });
    return;
  }
  AI_HTML = '';
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

  /* chọn nhanh theo lãnh đạo phụ trách — dùng đúng danh sách của bộ lọc "Lãnh đạo phụ trách" trên trang */
  var byId = {};
  (((typeof ASSIGNMENT_DATA !== 'undefined' && ASSIGNMENT_DATA) || {}).leaders || [])
    .forEach(function (L) { byId[L.id] = L; });

  function areasOf(L) {
    return (L.areas || []).filter(function (nm) {
      return rows.some(function (r) { return r.name === nm; });
    });
  }

  var leaders = [];
  var ls = document.getElementById('leaderSelect');
  if (ls) {
    [].forEach.call(ls.options, function (o) {
      if (String(o.value).indexOf('reference:') !== 0) return;
      var L = byId[String(o.value).slice(10)];
      if (!L) return;
      var areas = areasOf(L);
      if (areas.length) leaders.push({ label: (o.textContent || '').trim(), areas: areas });
    });
  }
  if (!leaders.length) {
    Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      .forEach(function (L, i) {
        var areas = areasOf(L);
        if (areas.length) leaders.push({ label: (i + 1 < 10 ? '0' : '') + (i + 1) + '. Đ/c ' + L.name, areas: areas });
      });
  }

  if (leaders.length) {
    var sel = document.createElement('select');
    sel.style.cssText = 'width:100%;margin-bottom:8px;padding:7px 9px;border:1px solid #d7dce3;border-radius:7px;font-size:13px;background:#fafbfc';
    var o0 = document.createElement('option');
    o0.value = ''; o0.textContent = 'Chọn nhanh theo lãnh đạo phụ trách…';
    sel.appendChild(o0);
    leaders.forEach(function (L, idx) {
      var o = document.createElement('option');
      o.value = String(idx);
      o.textContent = L.label + ' (' + L.areas.length + ' đơn vị)';
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      var L = leaders[Number(sel.value)];
      if (!L) return;
      list.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
        cb.checked = L.areas.indexOf(cb.value) >= 0;
      });
      count();
    });
    card.appendChild(sel);
  }

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

  var aiLab = document.createElement('label');
  aiLab.style.cssText = 'display:flex;gap:7px;align-items:flex-start;margin-top:10px;padding:7px 9px;border:1px solid #bcd9cb;border-radius:8px;background:#f1f8f4;font-size:12px;line-height:1.35;cursor:pointer';
  aiLab.innerHTML = '<input type="checkbox" id="quickAiChk" style="margin-top:2px"><span><b style="color:#0b6b4f">Thêm phần nhận định, đề xuất do AI hỗ trợ</b> <span style="color:#6b7280">(chờ khoảng 20–60 giây)</span></span>';
  card.appendChild(aiLab);

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
    var pw = picked(); if (!pw.length) { document.body.appendChild(wrap); info.textContent = 'Chưa chọn đơn vị nào'; return; } if (!window.__exportQuickWord) { window.__quickWord = true; try { btn.click(); } finally { window.__quickWord = false; } return; } wordWithAi(pw, !!aiLab.querySelector('input').checked);
  });
  foot.appendChild(word);

  var go = document.createElement('button');
  go.type = 'button'; go.textContent = 'Xem báo cáo';
  go.style.cssText = 'padding:7px 16px;border:0;border-radius:7px;background:#1e3a5f;color:#fff;font-weight:700;cursor:pointer;font-size:13px';
  go.addEventListener('click', function () {
    var p = picked();
    if (!p.length) { info.textContent = 'Chưa chọn đơn vị nào'; return; }
    var ai = !!(document.getElementById('quickAiChk') && document.getElementById('quickAiChk').checked);
    wrap.remove();
    showQuick(p, ai);
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
  /* Chỉ đóng khi bấm xuống VÀ nhả chuột đều ở nền ngoài khung; bôi đen/kéo chuột từ ô tìm kiếm ra ngoài không làm tắt bảng */
  var downOnBg = false;
  wrap.addEventListener('mousedown', function (e) { downOnBg = (e.target === wrap); });
  wrap.addEventListener('touchstart', function (e) { downOnBg = (e.target === wrap); }, { passive: true });
  wrap.addEventListener('click', function (e) {
    var ok = downOnBg && e.target === wrap;
    downOnBg = false;
    if (ok) wrap.remove();
  });
  card.addEventListener('keydown', function (e) { e.stopPropagation(); });
  document.body.appendChild(wrap);
  setTimeout(function () { try { search.focus(); } catch (err) {} }, 0);
}

window.openQuickViewReport = openQuickPicker;

/* Chặn nút "Báo cáo nhanh" sẵn có: bấm 1 cái là hiện báo cáo, không tải file.
   Nút "Tải bản Word" trong hộp chọn vẫn gọi lại chức năng xuất Word gốc. */
window.__showQuick = showQuick; function quickStamp() { var g = new Date(state.generatedAt || Date.now()), p = function (n) { return String(n).padStart(2, '0'); }; var closed = !!(state.cur && state.cur.period && state.cur.period.closed); return 'số liệu ' + (closed ? 'chốt' : 'tạm tính, kỳ chưa chốt') + ' đến ' + p(g.getHours()) + ':' + p(g.getMinutes()) + ' ngày ' + p(g.getDate()) + '/' + p(g.getMonth() + 1) + '/' + g.getFullYear(); } function quickSources(names) { var set = {}; names.forEach(function (n) { set[n] = 1; }); var com = state.units.filter(function (u) { return u.kind === 'commune' && u.p && u.p.all; }); var keys = [['I', 'I. Dự toán đầu năm'], ['II', 'II. Chương trình MTQG'], ['III', 'III. Bổ sung có mục tiêu'], ['IV', 'IV. KH+CN (NQ 57-NQ/TW)'], ['V', 'V. Dự phòng ngân sách']]; function pct(p, d) { return p > 0 ? Math.round(d / p * 1000) / 10 : null; } var bq = {}, tp = 0, td = 0; com.forEach(function (u) { tp += u.p.all[0]; td += u.p.all[1]; }); keys.forEach(function (k) { var p = 0, d = 0; com.forEach(function (u) { var a = u.p[k[0]]; if (a) { p += a[0]; d += a[1]; } }); bq[k[1]] = { duToan: Math.round(p), giaiNgan: Math.round(d), tyLe: pct(p, d) }; }); return { ghiChu: 'Số liệu từng nguồn vốn của từng đơn vị (triệu đồng); binhQuan56Xa là bình quân gộp của 56 xã, phường theo từng nguồn', binhQuan56Xa: Object.assign({ tongCacNguon: { duToan: Math.round(tp), giaiNgan: Math.round(td), tyLe: pct(tp, td) } }, bq), theoDonVi: com.filter(function (u) { return set[u.name]; }).map(function (u) { var o = { ten: u.name }; keys.forEach(function (k) { var a = u.p[k[0]]; if (a && a[0] > 0) o[k[1]] = { duToan: Math.round(a[0]), giaiNgan: Math.round(a[1]), conLai: Math.round(a[0] - a[1]), tyLe: pct(a[0], a[1]) }; }); return o; }) }; } function quickSourcesV2(names, tdtg) {
  var KEYS = [['I', 'I. Dự toán đầu năm'], ['II', 'II. Vốn Chương trình MTQG'], ['III', 'III. Bổ sung có mục tiêu'],
              ['IV', 'IV. KH&CN, chuyển đổi số (NQ 57-NQ/TW)'], ['V', 'V. Dự phòng ngân sách']];
  var MT = { '1': 'CTMTQG xây dựng NTM, giảm nghèo bền vững và phát triển KT-XH vùng ĐBDTTS&MN', '2': 'CTMTQG về phát triển văn hóa', '3': 'CTMTQG phòng, chống ma túy' };
  var r1 = function (v) { return Math.round(v * 10) / 10; }, m = function (v) { return Math.round(v); };
  var pct = function (a) { return a && a[0] > 0 ? r1(a[1] / a[0] * 100) : null; };
  var com = state.units.filter(function (u) { return u.kind === 'commune' && u.p && u.p.all && u.p.all[0] > 0; });
  var bq = {}; ['all'].concat(KEYS.map(function (k) { return k[0]; })).forEach(function (k) {
    var p = 0, d = 0; com.forEach(function (u) { var a = u.p[k]; if (a) { p += a[0]; d += a[1]; } }); bq[k] = p > 0 ? r1(d / p * 100) : null; });
  var rate = function (u) { return u.p.all[1] / u.p.all[0]; };
  var now = new Date(state.generatedAt || Date.now()), end = new Date(now.getFullYear(), 11, 31);
  var set = {}; names.forEach(function (n) { set[n] = 1; });
  var hasPrev = !!state.prevAt;
  var donVi = com.filter(function (u) { return set[u.name]; }).map(function (u) {
    var all = u.p.all, pv = (hasPrev && u.prev) || {}, left = all[0] - all[1];
    var nguon = {};
    KEYS.forEach(function (k) {
      var a = u.p[k[0]]; if (!a || !(a[0] > 0)) return;
      var b = pv[k[0]];
      nguon[k[1]] = { keHoach: m(a[0]), daGiaiNgan: m(a[1]), tyLe: pct(a), conLai: m(a[0] - a[1]), binhQuanNguon: bq[k[0]],
        tyTrongConLai: left > 0 ? r1((a[0] - a[1]) / left * 100) : 0,
        kyTruocDaGiaiNgan: b ? m(b[1]) : null, tangGiamSoKyTruoc: b ? m(a[1] - b[1]) : null };
    });
    var mt = Object.keys(u.mtqg || {}).filter(function (k) { return u.mtqg[k][0] > 0; }).map(function (k) {
      var a = u.mtqg[k]; return { ten: MT[k] || ('Chương trình mã ' + k), keHoach: m(a[0]), daGiaiNgan: m(a[1]), tyLe: pct(a), conLai: m(a[0] - a[1]) }; });
    return {
      ten: u.name, tenNgan: u.name.replace(/^Xã /, 'xã ').replace(/^Phường /, 'phường '), daGuiBaoCao: u.submitted === true, khongPhaiGui: u.status === 'exempt', guiMuon: u.status === 'late', capNhatLuc: u.updated || '',
      xepHang: 1 + com.filter(function (v) { return rate(v) > rate(u) + 1e-12; }).length + '/' + com.length,
      tongCong: { keHoach: m(all[0]), daGiaiNgan: m(all[1]), tyLe: pct(all), conLai: m(left), binhQuan: bq.all,
        soVoiBinhQuan: r1(pct(all) - bq.all), soVoiTienDo: tdtg == null ? null : r1(pct(all) - tdtg),
        kyTruocDaGiaiNgan: pv.all ? m(pv.all[1]) : null, tangGiamSoKyTruoc: pv.all ? m(all[1] - pv.all[1]) : null },
      nguonVon: nguon, chuongTrinhMTQG: mt
    };
  });
  return { ghiChu: 'Đơn vị tiền: triệu đồng; tỷ lệ: %; binhQuanNguon là bình quân gộp 56 xã, phường của chính nguồn đó',
    kyTruoc: hasPrev ? 'mốc ' + state.prevAt : 'không có', hanChot: (state.period && state.period.cutoffText) || '',
    soNgayConLai: Math.max(0, Math.round((end - now) / 864e5)), binhQuan56Xa: bq, donViChiTiet: donVi };
} function waitBox(msg) { if (!document.getElementById('wbStyle')) { var st = document.createElement('style'); st.id = 'wbStyle'; st.textContent = '@keyframes wbSpin{to{transform:rotate(360deg)}}@keyframes wbBar{0%{left:-40%}100%{left:100%}}'; document.head.appendChild(st); } var el = document.createElement('div'); el.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px'; el.innerHTML = '<div style="background:#fff;color:#111;border-radius:14px;padding:22px 26px;max-width:380px;width:100%;text-align:center;box-shadow:0 18px 48px rgba(0,0,0,.3)"><div style="width:46px;height:46px;margin:0 auto 12px;border:4px solid #d6eadf;border-top-color:#0b6b4f;border-radius:50%;animation:wbSpin .9s linear infinite"></div><div style="font-weight:700;font-size:15px;color:#0b6b4f">' + msg + '</div><div style="font-size:12.5px;color:#6b7280;margin-top:6px">Vui lòng giữ nguyên trang, không tắt cửa sổ. File Word sẽ tự tải về khi xong.</div><div style="position:relative;height:6px;border-radius:3px;background:#e5efe9;overflow:hidden;margin-top:14px"><div style="position:absolute;top:0;bottom:0;width:40%;border-radius:3px;background:#0b6b4f;animation:wbBar 1.3s ease-in-out infinite"></div></div><div class="wbT" style="font-size:12px;color:#6b7280;margin-top:8px">Đã chờ 0 giây</div></div>'; document.body.appendChild(el); var t0 = Date.now(), iv = setInterval(function () { var s = Math.round((Date.now() - t0) / 1000), n = el.querySelector('.wbT'); if (n) n.textContent = 'Đã chờ ' + s + ' giây'; }, 1000); var r0 = el.remove.bind(el); el.remove = function () { clearInterval(iv); r0(); }; return el; } function wordWithAi(names, useAi) { if (!useAi || !window.gnAI) { window.__exportQuickWord(names, ''); return; } var set = {}; names.forEach(function (n) { set[n] = 1; }); var rows0 = allRows().filter(function (r) { return set[r.name]; }), per0 = state.period || {}; var toast = document.createElement('div'); toast = waitBox('Đang soạn nhận định AI để đưa vào file Word'); window.gnAI.assess({ kind: 'nhanh', title: 'Báo cáo nhanh – nhóm ' + rows0.length + ' đơn vị được chọn', period: (per0.label || '') + ' (' + quickStamp() + ')', timePct: timePct(), sources: quickSourcesV2(names, Math.round(timePct() * 10) / 10), rows: rows0 }).then(function (text) { return text; }, function (err) { alert('Chưa tạo được phần AI hỗ trợ: ' + ((err && err.message) || 'lỗi không xác định') + ' File Word vẫn được lập, không có phần này.'); return ''; }).then(function (text) { toast.remove(); window.__exportQuickWord(names, text); }); } function hookQuick() {
  var btn = document.getElementById('quickReportBtn');
  if (!btn || btn.dataset.viewHooked) return;
  btn.dataset.viewHooked = '1';
  btn.addEventListener('click', function (e) {
    if (e.__allowWord || window.__quickWord) return;
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


/* ============================================================
   AI HỖ TRỢ cho báo cáo lãnh đạo và báo cáo nhanh.
   AI soạn nhận định, giải pháp, nhắc nhở từ số liệu các kỳ; kết quả đặt trong khung riêng,
   ghi rõ là tham khảo, cần rà soát trước khi sử dụng. Người lập: Lục Hồng Kỳ
   ============================================================ */
(function () {
'use strict';
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function r1(v) { return v == null ? null : Math.round(v * 10) / 10; }

var SYS_NHANH = "KIẾN THỨC NỀN (chỉ dùng để lập luận, nhận định; không thay thế số liệu trong dữ liệu được cấp)\n\n1. Căn cứ pháp lý chính\n- Luật Ngân sách nhà nước số 89/2025/QH15, hiệu lực từ năm ngân sách 2026; Nghị định số 73/2026/NĐ-CP ngày 10/3/2026 hướng dẫn Luật; Thông tư số 26/2026/TT-BTC ngày 25/3/2026.\n- Chỉ thị số 22/CT-TTg ngày 22/5/2026 của Thủ tướng Chính phủ về đẩy nhanh tiến độ thực hiện các Chương trình MTQG giai đoạn 2026–2030.\n- Văn bản chỉ đạo của UBND tỉnh: Công văn số 4099/UBND-TH ngày 22/10/2026, Công văn số 4055/UBND-KT ngày 20/10/2026.\n- Không dẫn văn bản nào khác nếu không có trong dữ liệu được cấp hoặc danh sách này.\n\n2. Mốc thời gian phải bám\n- Mục tiêu Chính phủ năm 2026 đối với vốn CTMTQG: giải ngân 100% kinh phí thường xuyên (sự nghiệp) trước 31/12/2026; 100% vốn đầu tư trước 31/01/2027. Dashboard theo dõi vốn thường xuyên, nên mốc của vốn MTQG trong dashboard là 31/12/2026.\n- Vốn CTMTQG năm 2025 được kéo dài sang năm 2026: phải giải ngân hết trong năm 2026.\n- Năm ngân sách kết thúc 31/12. Hết thời gian chỉnh lý quyết toán, dự toán chưa chi hết phải hủy bỏ, trừ các khoản được chuyển nguồn.\n- Các mốc theo dõi của tỉnh: 30/11, 10/12, 20/12, 31/12/2026 và 31/01/2027.\n\n3. Nguyên tắc chuyển nguồn và hủy dự toán (Luật NSNN 2025, Nghị định 73/2026/NĐ-CP)\n- Được xem xét chuyển nguồn khi còn nhiệm vụ chi, gồm: dự toán bổ sung sau 30/9 (trừ khoản đã hết nhiệm vụ chi); CTMTQG còn trong thời gian thực hiện; khoản đã ký hợp đồng hoặc hoàn thành đấu thầu nhưng chưa thanh toán; kinh phí thực hiện chính sách tiền lương, an sinh xã hội; chi khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số; kinh phí tự chủ của đơn vị sự nghiệp; viện trợ, tài trợ đã xác định nhiệm vụ chi.\n- Khoản không còn nhiệm vụ chi, hoặc không thuộc diện chuyển nguồn, thì bị hủy dự toán.\n- Tạm ứng chưa đủ thủ tục thanh toán: nếu thuộc diện chuyển nguồn thì chuyển số dư sang năm sau; nếu không thì phải hoàn trả ngân sách trước 15/2 năm sau, quá hạn Kho bạc thu hồi.\n- Hệ quả cho nhận định: số không giải ngân được không tự động được giữ lại. Đơn vị phải sớm phân loại từng khoản: (i) còn nhiệm vụ, giải ngân được trong năm; (ii) còn nhiệm vụ, đủ điều kiện chuyển nguồn; (iii) hết nhiệm vụ chi, đề nghị thu hồi hoặc điều chuyển.\n\n4. Dự phòng ngân sách (Điều 10 Luật NSNN 2025)\n- Bố trí từ 2% đến 5% tổng chi mỗi cấp; dùng cho nhiệm vụ cấp bách, đột xuất phát sinh ngoài dự toán như phòng, chống, khắc phục thiên tai, dịch bệnh, quốc phòng, an ninh.\n- Không đánh giá dự phòng theo tiêu chí \"giải ngân chậm\". Chỉ theo dõi việc sử dụng đúng mục đích, đúng thẩm quyền và báo cáo tình hình sử dụng.\n\n5. Nhóm nguyên nhân chậm giải ngân thường gặp (dùng để GỢI Ý nguyên nhân cần xác minh, không khẳng định)\n- (N1) Cơ chế, hướng dẫn: thiếu hoặc chậm văn bản hướng dẫn, nguyên tắc, tiêu chí, định mức phân bổ; giao dự toán muộn.\n- (N2) Phân loại kinh phí: lúng túng khi xác định khoản đã hết nhiệm vụ chi, khoản còn nhiệm vụ nhưng không thực hiện được; rà soát, điều chỉnh kinh phí sau sắp xếp đơn vị hành chính.\n- (N3) Năng lực cấp xã: thiếu cán bộ am hiểu đầu tư, đấu thầu, ngân sách, thanh quyết toán.\n- (N4) Tâm lý e ngại trách nhiệm: chờ hướng dẫn cấp trên với việc đã thuộc thẩm quyền.\n- (N5) Hồ sơ, thủ tục: chậm nghiệm thu, hoàn thiện hồ sơ thanh toán; công trình đã xong nhưng chưa thanh toán.\n- (N6) Đối tượng thụ hưởng: khó xác định đối tượng của dự án sinh kế, đào tạo nghề, hỗ trợ sản xuất.\n- (N7) Phối hợp, số liệu: đối chiếu giữa chủ đầu tư, cơ quan tài chính và Kho bạc chưa kịp thời; số liệu báo cáo thiếu đồng bộ.\n- (N8) Khách quan: thời tiết, địa hình, giải phóng mặt bằng, cung ứng vật liệu.\n- Gợi ý theo dấu hiệu số liệu: nguồn 0% → thường do N1, N2 hoặc N6; có giải ngân nhưng không tăng qua các kỳ → thường do N5 hoặc N7; tỷ lệ thấp ở hầu hết các nguồn → thường do N3 hoặc N4; số liệu giảm so kỳ trước → do điều chỉnh, hoàn trả hoặc nhập sai, cần giải trình.\n\n6. Nhóm giải pháp chuẩn (chọn theo nguyên nhân: \"nguyên nhân nào, giải pháp đó\")\n- (G1) Rà soát từng nhiệm vụ, dự án; phân loại ba nhóm kinh phí như mục 3; lập danh mục kèm số tiền.\n- (G2) Thanh toán ngay khối lượng đã hoàn thành; nghiệm thu, thanh toán song song với thi công, không dồn cuối năm.\n- (G3) Xử lý dứt điểm vướng mắc thuộc thẩm quyền; vượt thẩm quyền thì báo cáo bằng văn bản, nêu rõ nội dung và cơ quan cần xử lý.\n- (G4) Khoản không có khả năng giải ngân: báo cáo Sở Tài chính để tham mưu điều chuyển, thu hồi; không để đến cuối năm.\n- (G5) Giao việc theo nguyên tắc rõ người, rõ việc, rõ thời hạn, rõ kết quả; theo dõi tiến độ hằng tuần theo từng nhiệm vụ.\n- (G6) Gắn kết quả giải ngân với trách nhiệm người đứng đầu, trực tiếp là Chủ tịch UBND cấp xã, và với đánh giá, phân loại cán bộ cuối năm (theo tinh thần Chỉ thị 22/CT-TTg).\n- (G7) Đối chiếu số liệu với Kho bạc định kỳ; cập nhật đầy đủ, đúng hạn trên hệ thống theo dõi.\n- (G8) Kiến nghị biểu dương đơn vị giải ngân tốt; phê bình đơn vị chậm, không chuyển biến qua các kỳ.\n\n7. Bối cảnh của tỉnh (chỉ dùng khi phân tích toàn tỉnh, không gán cho từng xã)\n- Năm 2026, giải ngân của Cao Bằng ở mức thấp so với cả nước; UBND tỉnh yêu cầu xử lý theo thực trạng từng dự án, gắn tiến độ với KPI người đứng đầu, mỗi việc chậm phải có nguyên nhân, người chịu trách nhiệm và thời hạn.\n- Đôn đốc phải đi kèm giải quyết công việc thực tế, không chỉ tăng số cuộc họp.\n\nVAI TRÒ\nBạn là chuyên viên Phòng Ngân sách, Sở Tài chính tỉnh Cao Bằng. Bạn soạn phần NHẬN ĐỊNH và KIẾN NGHỊ để hệ thống ghép thẳng vào báo cáo nhanh tình hình giải ngân vốn ngân sách của xã, phường gửi lãnh đạo UBND tỉnh. Không viết lời mở đầu, kết luận chung hay mục nào khác.\n\nDỮ LIỆU ĐẦU VÀO (JSON)\n- tienDoThoiGianNam: % thời gian của năm đã qua.\n- kyBaoCao: kỳ báo cáo; có chữ \"tạm tính\" là số chưa chốt.\n- nguonVon.soNgayConLai: số ngày còn lại đến 31/12.\n- nguonVon.hanChot: hạn gửi báo cáo kỳ này.\n- nguonVon.binhQuan56Xa: tỷ lệ bình quân gộp của 56 xã, phường, theo tổng và theo từng nguồn (I–V).\n- nguonVon.donViChiTiet[]: mỗi đơn vị gồm\n  - ten, tenNgan, xepHang, daGuiBaoCao, khongPhaiGui, capNhatLuc;\n  - tongCong: keHoach, daGiaiNgan, tyLe, conLai, binhQuan, soVoiBinhQuan, soVoiTienDo, tangGiamSoKyTruoc;\n  - nguonVon: theo từng nguồn, gồm keHoach, daGiaiNgan, tyLe, conLai, binhQuanNguon, tyTrongConLai, tangGiamSoKyTruoc;\n  - chuongTrinhMTQG[]: ten, keHoach, daGiaiNgan, tyLe, conLai.\n- xuHuong.theoDonVi: tỷ lệ của đơn vị qua các kỳ, từ cũ đến mới.\n\nA. NGUYÊN TẮC SỐ LIỆU\n1. Chỉ dùng số có trong dữ liệu. Không bịa số, tên văn bản hay số công văn. Không tự tính số mới, trừ phép trừ đơn giản giữa hai số đã có.\n2. Tiền ghi bằng triệu đồng, làm tròn đến triệu đồng, dùng dấu chấm ngăn cách hàng nghìn (7.173 triệu đồng).\n3. Tỷ lệ ghi 1 chữ số thập phân với dấu phẩy (57,4%). Chênh lệch giữa hai tỷ lệ luôn ghi \"điểm %\" (thấp hơn 0,8 điểm %).\n4. Xu hướng viết bằng mũi tên \"→\" (26,6% → 55,8% → 55,8%), không dùng dấu \">\".\n5. Kỳ tạm tính thì ghi \"tạm tính\", không viết như số đã chốt.\n6. Gọi đơn vị theo tenNgan (\"xã Lý Bôn\", \"UBND xã Lý Bôn\"). Gọi nguồn bằng tên đầy đủ: dự toán đầu năm, vốn Chương trình MTQG, vốn bổ sung có mục tiêu, vốn KH&CN, chuyển đổi số theo NQ 57, dự phòng ngân sách. Không chỉ ghi số La Mã.\n\nB. QUY TẮC ĐÁNH GIÁ (cho từng đơn vị)\n1. Tiến độ: chỉ ĐẠT khi tỷ lệ tổng bằng hoặc cao hơn tienDoThoiGianNam, hoặc từ 90% trở lên. Dưới mức đó luôn ghi CHẬM so với tiến độ thời gian, kể cả khi cao hơn bình quân. Cấm dùng \"duy trì đà\", \"đạt khá\", \"tiếp tục theo kế hoạch\". Vừa chậm vừa thấp hơn bình quân thì thêm \"thuộc nhóm cần ưu tiên đôn đốc\". Dưới 30% là \"ưu tiên cao\".\n2. Câu đánh giá chung luôn nêu đủ: tỷ lệ; so bình quân 56 xã, phường (điểm %) kèm thứ hạng; so tiến độ thời gian (điểm %); số còn lại so với số ngày còn lại; xu hướng nếu có từ 2 kỳ.\n3. Kết quả tích cực: nguồn đạt từ 95% trở lên (\"đã hoàn thành\" nếu 100%, \"cơ bản hoàn thành\" nếu từ 95% đến dưới 100%), hoặc nguồn cao hơn bình quân của chính nguồn đó từ 10 điểm % trở lên, hoặc nguồn tăng trong kỳ (nêu số tăng). Chương trình MTQG đạt từ 95% được nêu thêm.\n4. Nguồn trọng tâm: trong các nguồn dưới 95% (trừ dự phòng), chọn nguồn có SỐ CÒN LẠI LỚN NHẤT. Nêu tỷ lệ, chênh lệch so với bình quân nguồn, số còn lại, tyTrongConLai và việc có phát sinh giải ngân trong kỳ hay không.\n   - Nếu nguồn đó thấp hơn bình quân nguồn: nhãn \"Điểm nghẽn chính:\".\n   - Nếu nguồn đó bằng hoặc cao hơn bình quân nguồn: nhãn \"Khối lượng còn lại lớn nhất:\".\n5. Các nguồn khác dưới 95% và thấp hơn bình quân nguồn: mỗi nguồn một dòng, ghi tỷ lệ, chênh lệch, số còn lại.\n6. Chương trình MTQG:\n   - Dòng \"Chương trình MTQG chưa giải ngân:\" chỉ gồm chương trình có daGiaiNgan bằng 0 (nêu tên và kế hoạch).\n   - Chương trình đã giải ngân nhưng dưới 30% ghi ở dòng riêng \"Chương trình MTQG giải ngân thấp:\".\n7. Dự phòng ngân sách là nguồn dự trữ cho nhiệm vụ đột xuất. Không đôn đốc giải ngân hết và không coi tỷ lệ thấp là chậm; chỉ ghi số đã sử dụng. Nếu số đã sử dụng giảm so kỳ trước thì yêu cầu làm rõ nguyên nhân (điều chỉnh số liệu, hoàn trả hay nhập nhầm).\n8. Nguồn khác (không phải dự phòng) có tangGiamSoKyTruoc âm thì bắt buộc yêu cầu giải trình, ghi ở dòng \"Số liệu giảm so kỳ trước:\". Không có thì bỏ dòng này.\n9. Đơn vị chưa gửi báo cáo (daGuiBaoCao = false, khongPhaiGui = false): ghi rõ số liệu là số đang nhập, chưa phản ánh đầy đủ. Không so tăng giảm như số chính thức và không viết \"không phát sinh giải ngân trong kỳ\".\n10. Đơn vị đã giải ngân 100% (khongPhaiGui = true): chỉ ghi nhận hoàn thành.\n\n11. Nguyên nhân: với nguồn 0%, nguồn không tăng qua các kỳ hoặc nguồn có số còn lại lớn nhất, nêu 1 nguyên nhân có thể theo KIẾN THỨC NỀN mục 5, mở đầu bằng \"có thể do\", kết thúc bằng \"cần xác minh\". Không nêu nguyên nhân khi dữ liệu không có dấu hiệu tương ứng.\n12. Rủi ro cuối năm: nếu số còn lại lớn so với soNgayConLai, nêu rủi ro dự toán bị hủy do không đủ điều kiện chuyển nguồn, và yêu cầu phân loại kinh phí (KIẾN THỨC NỀN mục 3).\n\nC. QUY TẮC KIẾN NGHỊ\n1. Chỉ giao việc cho chính UBND xã, phường. Xếp theo số còn lại của nguồn, từ lớn đến nhỏ. Mỗi việc ghi tên nguồn và số còn lại trong ngoặc.\n2. Nếu chưa gửi báo cáo: việc (1) là gửi báo cáo trước hanChot.\n3. Vốn bổ sung có mục tiêu, hoặc nguồn có số còn lại lớn nhất: rà soát từng nhiệm vụ, dự án; trước 10/12/2026 hoàn thiện hồ sơ nghiệm thu, thanh toán khối lượng đã thực hiện; trước 20/12/2026 báo cáo Sở Tài chính danh mục, số vốn không có khả năng giải ngân để điều chỉnh.\n4. Vốn Chương trình MTQG (gộp thành một việc): triển khai ngay chương trình còn 0% (nêu tên, số vốn); đẩy nhanh chương trình giải ngân thấp; hoàn thành giải ngân 100% kinh phí thường xuyên trước 31/12/2026 theo mục tiêu của Chính phủ; trước 20/12/2026 báo cáo Sở Tài chính phần không thể giải ngân, phân loại rõ phần còn nhiệm vụ đủ điều kiện chuyển nguồn và phần hết nhiệm vụ chi.\n5. Nguồn khác dưới 95%: đẩy nhanh, hoàn thành trước 31/12/2026.\n6. Dự phòng: báo cáo tình hình sử dụng dự phòng trong kỳ báo cáo tiếp theo, kèm giải trình nếu số liệu giảm.\n7a. Với nguồn có số còn lại từ 30% kế hoạch của nguồn trở lên: thêm yêu cầu lập danh sách khoản còn lại, phân loại (i) giải ngân được trong năm, (ii) đủ điều kiện chuyển nguồn, (iii) hết nhiệm vụ chi; gửi Sở Tài chính trước 20/12/2026.\n7b. Đơn vị thấp hơn bình quân và không tăng qua 2 kỳ liên tiếp: thêm yêu cầu Chủ tịch UBND xã, phường trực tiếp chỉ đạo, giao việc rõ người, rõ việc, rõ thời hạn.\n7. Việc cuối cùng luôn là: cập nhật số liệu giải ngân đầy đủ, đúng hạn trên hệ thống hằng kỳ.\n8. Không giao việc đẩy nhanh cho nguồn đã đạt từ 95% trở lên.\n\nD. ĐỊNH DẠNG ĐẦU RA (bắt buộc để hệ thống ghép vào báo cáo)\n- Đúng hai khối. Khối 1 mở đầu bằng dòng \"NHẬN ĐỊNH:\". Khối 2 mở đầu bằng dòng \"KIẾN NGHỊ:\".\n- NHẬN ĐỊNH, với mỗi đơn vị theo thứ tự trong donViChiTiet:\n  - dòng đầu là \"- \" + tenNgan viết hoa chữ cái đầu + \": \" + câu đánh giá chung (ví dụ \"- Xã Lý Bôn: Tỷ lệ giải ngân tạm tính đạt …\");\n  - tiếp theo là các dòng \"- Nhãn: nội dung\". Nhãn theo thứ tự: Kết quả tích cực / Điểm nghẽn chính (hoặc Khối lượng còn lại lớn nhất) / tên từng nguồn cần lưu ý / Chương trình MTQG chưa giải ngân / Chương trình MTQG giải ngân thấp / Dự phòng ngân sách / Số liệu giảm so kỳ trước. Nhãn không có nội dung thì bỏ.\n  - Không viết chữ \"Tên đơn vị\" vào nội dung.\n- KIẾN NGHỊ, với mỗi đơn vị:\n  - một dòng \"- Đề nghị UBND [tenNgan] tập trung thực hiện:\";\n  - mỗi việc một dòng \"- (1) Tên nguồn (số còn lại triệu đồng): nội dung việc\".\n- Mỗi dòng không quá 70 từ.\n- Từ 4 đơn vị trở lên: mỗi đơn vị chỉ 1 dòng nhận định (tối đa 4 câu) và 1 dòng kiến nghị (các việc đánh số nối tiếp trong cùng dòng).\n- Không dùng ký hiệu markdown (#, *, **) và không dùng bảng.\n\nVÍ DỤ ĐẦU RA CHUẨN (xã Tĩnh Túc):\nNHẬN ĐỊNH:\n- Xã Tĩnh Túc: Tỷ lệ giải ngân tạm tính đạt 57,4%, cao hơn bình quân 56 xã, phường 0,8 điểm %, xếp thứ 22/56, nhưng thấp hơn tiến độ thời gian năm 33,3 điểm %, vẫn CHẬM so với tiến độ; tỷ lệ qua các kỳ 54,5% → 57,4%. Còn 13.609 triệu đồng phải giải ngân trong 33 ngày còn lại của năm là khối lượng lớn.\n- Kết quả tích cực: vốn KH&CN, chuyển đổi số theo NQ 57 đạt 99,8%, cơ bản hoàn thành; dự toán đầu năm đạt 78,8%, cao hơn bình quân nguồn 24,7 điểm %, tăng 998 triệu đồng trong kỳ.\n- Điểm nghẽn chính: vốn bổ sung có mục tiêu đạt 53,5%, thấp hơn bình quân nguồn 13,4 điểm %, còn 7.173 triệu đồng, chiếm 52,7% số còn lại của xã; không phát sinh giải ngân trong kỳ.\n- Chương trình MTQG chưa giải ngân: CTMTQG về phát triển văn hóa (920 triệu đồng); CTMTQG phòng, chống ma túy (640 triệu đồng).\n- Dự phòng ngân sách: số đã sử dụng giảm từ 151 triệu đồng về 0 so với kỳ trước, cần làm rõ nguyên nhân (điều chỉnh số liệu, hoàn trả hay nhập nhầm); dự phòng không bắt buộc giải ngân hết.\nKIẾN NGHỊ:\n- Đề nghị UBND xã Tĩnh Túc tập trung thực hiện:\n- (1) Vốn bổ sung có mục tiêu (7.173 triệu đồng): rà soát từng nhiệm vụ, dự án; trước 10/12/2026 hoàn thiện hồ sơ nghiệm thu, thanh toán khối lượng đã thực hiện; trước 20/12/2026 báo cáo Sở Tài chính danh mục, số vốn không có khả năng giải ngân để điều chỉnh.\n- (2) Vốn Chương trình MTQG (3.225 triệu đồng): triển khai ngay CTMTQG về phát triển văn hóa (920 triệu đồng) và CTMTQG phòng, chống ma túy (640 triệu đồng), có thể do chậm xác định đối tượng, nội dung thực hiện, cần xác minh; đẩy nhanh phần còn lại; hoàn thành giải ngân trước 31/12/2026; trước 20/12/2026 báo cáo Sở Tài chính phần không thể giải ngân, phân loại phần đủ điều kiện chuyển nguồn và phần hết nhiệm vụ chi.\n- (3) Dự toán đầu năm (1.662 triệu đồng): đẩy nhanh giải ngân, hoàn thành trước 31/12/2026.\n- (4) Dự phòng ngân sách: giải trình việc giảm 151 triệu đồng so với kỳ trước và báo cáo tình hình sử dụng dự phòng trong kỳ báo cáo tiếp theo.\n- (5) Cập nhật số liệu giải ngân đầy đủ, đúng hạn trên hệ thống hằng kỳ.\nChỉ học cách trình bày và lập luận của ví dụ; số liệu phải lấy từ dữ liệu được cấp.";
var SYS = 'Bạn là chuyên viên cao cấp Phòng Ngân sách, Sở Tài chính tỉnh Cao Bằng, soạn phần "Nhận định và đề xuất chuyên sâu" trong báo cáo giải ngân vốn thường xuyên gửi lãnh đạo tỉnh. ' +
  'Văn phong hành chính, chặt chẽ, tiếng Việt, đơn vị triệu đồng, tỷ lệ làm tròn một chữ số thập phân, độ dài khoảng 450–650 từ. ' +
  'Trình bày đúng năm phần, mỗi tiêu đề một dòng riêng: ' +
  '"1. Nhận định chung" (3–4 câu: tỷ lệ giải ngân so với tiến độ thời gian của năm, xu hướng qua các kỳ nếu có dữ liệu, mức độ rủi ro không hoàn thành kế hoạch đến 31/12/2026 và 31/01/2027); ' +
  '"2. Phân nhóm đơn vị và nguyên nhân có thể" (dựa vào phanNhom trong dữ liệu: nhóm giải ngân dưới 30%, từ 30% đến dưới 60%, từ 60% trở lên, nhóm giảm so với kỳ trước, nhóm chưa gửi báo cáo; nêu tên đơn vị trọng tâm và nguyên nhân chỉ ở mức khả năng cần xác minh); ' +
  '"3. Giải pháp chuyên sâu" (4–6 ý gạch đầu dòng bằng dấu gạch ngang, mỗi ý theo từng nhóm đơn vị hoặc nguồn vốn, nêu rõ: việc cần làm cụ thể, cơ quan hoặc đầu mối chủ trì như Phòng Ngân sách, Phòng Hành chính sự nghiệp, UBND cấp xã, chủ đầu tư, Kho bạc Nhà nước, mốc hoàn thành gắn với các mốc báo cáo 30/11, 10/12, 20/12, 31/12/2026 và 31/01/2027, và kết quả đề xuất đạt được, ghi rõ là mục tiêu đề xuất); ' +
  '"4. Kiến nghị, đề xuất cơ chế" (2–3 ý: giao ban, kiểm tra thực tế, điều chuyển kinh phí không thể giải ngân hết trong năm, biểu dương đơn vị giải ngân tốt, phê bình đơn vị chậm không chuyển biến); ' +
  '"5. Nội dung nhắc nhở gửi đơn vị" (một đoạn văn bản soạn sẵn, lịch sự, đúng thể thức, nhắc đơn vị chưa gửi báo cáo, đơn vị giải ngân thấp, đơn vị có số giảm so với kỳ trước phải giải trình; có thể dẫn Công văn số 4099/UBND-TH ngày 22/10/2026 và Công văn số 4055/UBND-KT ngày 20/10/2026 của UBND tỉnh). ' +
  'Giải pháp phải cụ thể, khác nhau giữa các nhóm, tránh nêu chung chung. Chỉ dùng số liệu và tên đơn vị có trong dữ liệu; không bịa số liệu hay văn bản pháp luật nào khác. ' +
  'Nếu dữ liệu các kỳ trước trống hoặc chỉ có một kỳ thì nói rõ chưa đủ cơ sở đánh giá xu hướng. Không dùng ký hiệu markdown (#, *, **).';

function getHist() {
  return fetch('/api/history', { credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : { periods: [] }; })
    .then(function (d) { return Array.isArray(d.periods) ? d.periods : []; }, function () { return []; });
}

function trendLines(names, hist) {
  var cur = state.cur || { units: state.units || [], period: state.period };
  var idOf = {}; (cur.units || []).forEach(function (u) { idOf[u.name] = String(u.id); });
  var ps = hist.slice();
  if (cur.period && cur.period.key && !ps.some(function (p) { return p.key === cur.period.key; })) {
    ps.push({ key: cur.period.key, label: cur.period.label, final: false, units: (cur.units || []).filter(function (u) { return u.p && u.p.all; })
      .map(function (u) { return [String(u.id), u.p.all[0], u.p.all[1], u.status]; }) });
  }
  ps.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
  var byP = ps.map(function (p) { var m = {}; (p.units || []).forEach(function (r) { m[String(r[0])] = r; }); return m; });
  var lines = names.map(function (n) {
    var id = idOf[n]; if (!id) return null;
    var vals = byP.map(function (m) { var r = m[id]; return r && r[1] > 0 ? r1(r[2] / r[1] * 100) : '-'; });
    return n + ': ' + vals.join(' > ');
  }).filter(Boolean);
  return { cacKy: ps.map(function (p) { return (p.label || p.key) + (p.final ? '' : ' (tạm tính)'); }), lines: lines };
}

function loadingPage() {
  return '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Đang lập báo cáo…</title></head>' +
    '<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#1e3a5f;background:#f4f7fa">' +
    '<div style="text-align:center"><div style="font-size:18px;font-weight:700">Đang lập báo cáo có AI hỗ trợ…</div>' +
    '<div style="margin-top:8px;color:#6b7280;font-size:14px">Vui lòng chờ khoảng 20–60 giây, không đóng cửa sổ này.</div></div></body></html>';
}

/* Quy tắc hệ thống (không phụ thuộc AI): xã, phường đã gửi báo cáo, thấp hơn bình quân 56 xã, phường và không tăng qua 2 kỳ liên tiếp
   thì bắt buộc có việc "Chủ tịch UBND trực tiếp chỉ đạo". Người lập: Lục Hồng Kỳ. */
function chiDaoFlags(src, trLines) {
  var out = [];
  if (!src || !Array.isArray(src.donViChiTiet)) return out;
  var hist = {};
  (trLines || []).forEach(function (l) { var i = l.indexOf(': '); if (i > 0) hist[l.slice(0, i)] = l.slice(i + 2).split(' > ').map(function (v) { return v === '-' ? null : Number(v); }); });
  src.donViChiTiet.forEach(function (u) {
    var t = u.tongCong || {}, v = (hist[u.ten] || []).filter(function (x) { return x != null && isFinite(x); });
    if (!u.daGuiBaoCao || u.khongPhaiGui || t.tyLe == null || t.binhQuan == null || !(t.tyLe < t.binhQuan) || v.length < 3) return;
    var n = v.length;
    if (v[n - 1] <= v[n - 2] + 0.05 && v[n - 2] <= v[n - 3] + 0.05) out.push({ ten: u.tenNgan || u.ten, chuoi: v.slice(-3).map(function (x) { return String(x).replace('.', ',') + '%'; }).join(' → ') });
  });
  return out;
}
function enforceChiDao(text, flags) {
  if (!flags.length) return text;
  var lines = String(text).replace(/\r/g, '').split('\n');
  var k = lines.findIndex(function (l) { return /^\s*KIẾN NGHỊ\s*:?\s*$/i.test(l.replace(/\*/g, '')); });
  flags.forEach(function (f) {
    var viec = 'Chủ tịch UBND ' + f.ten + ' trực tiếp chỉ đạo (tỷ lệ thấp hơn bình quân 56 xã, phường và không tăng qua 2 kỳ liên tiếp: ' + f.chuoi + '): giao việc rõ người, rõ việc, rõ thời hạn, rõ kết quả cho từng nguồn còn chậm; báo cáo kết quả trong kỳ báo cáo tiếp theo.';
    var low = f.ten.toLowerCase();
    if (lines.some(function (l) { return /trực tiếp chỉ đạo/i.test(l) && l.toLowerCase().indexOf(low) >= 0; })) return;
    var head = -1;
    for (var i = Math.max(0, k); i < lines.length; i++) if (/Đề nghị UBND/i.test(lines[i]) && lines[i].toLowerCase().indexOf(low) >= 0) { head = i; break; }
    if (head < 0) { lines.push('- ' + viec); return; }
    var end = head + 1;
    while (end < lines.length && /^\s*-?\s*\(\d+\)/.test(lines[end])) end++;
    if (end === head + 1 && /\(\d+\)/.test(lines[head])) { lines[head] = lines[head].replace(/\s*$/, '') + ' (bổ sung) ' + viec; return; }
    var last = end - 1, m = lines[last] && /^(\s*-?\s*)\((\d+)\)(.*)$/.exec(lines[last]);
    if (m && /cập nhật số liệu/i.test(m[3])) { lines.splice(last, 0, m[1] + '(' + m[2] + ') ' + viec); lines[last + 1] = m[1] + '(' + (Number(m[2]) + 1) + ')' + m[3]; }
    else { var nn = m ? Number(m[2]) + 1 : 1; lines.splice(end, 0, '- (' + nn + ') ' + viec); }
  });
  return lines.join('\n');
}

function assess(o) {
  var rows = o.rows || [], gi = 0, gn = 0, sent = 0, miss = 0;
  rows.forEach(function (r) { gi += r.gi; gn += r.gn; if (r.submitted) sent++; else if (!r.exempt) miss++; });
  return getHist().then(function (hist) {
    var names = rows.map(function (r) { return r.name; });
    var tr = trendLines(names, hist);
    var ctx = {
      loaiBaoCao: o.title, kyBaoCao: o.period, tienDoThoiGianNam: r1(o.timePct) + '%',
      tong: { soDonVi: rows.length, duToan: Math.round(gi), giaiNgan: Math.round(gn), tyLe: gi > 0 ? r1(gn / gi * 100) : null, daGui: sent, chuaGui: miss },
      nguonVon: o.sources || null,
      phanNhom: (function () {
        function nm(a) { return a.slice(0, 30).map(function (r) { return r.name + ' (' + r1(r.tl) + '%)'; }); }
        var act = rows.filter(function (r) { return !r.exempt; });
        return {
          duoi30: nm(act.filter(function (r) { return r.tl < 30; }).sort(function (a, b) { return a.tl - b.tl; })),
          tu30Den60: nm(act.filter(function (r) { return r.tl >= 30 && r.tl < 60; }).sort(function (a, b) { return a.tl - b.tl; })),
          tu60TroLen: nm(act.filter(function (r) { return r.tl >= 60; }).sort(function (a, b) { return b.tl - a.tl; })),
          giamSoVoiKyTruoc: rows.filter(function (r) { return r.giam; }).slice(0, 30).map(function (r) { return r.name; }),
          chuaGuiBaoCao: rows.filter(function (r) { return !r.submitted && !r.exempt; }).slice(0, 40).map(function (r) { return r.name; })
        };
      })(),
      donVi: rows.slice(0, 90).map(function (r) { return { ten: r.name, duToan: Math.round(r.gi), giaiNgan: Math.round(r.gn), tyLe: r1(r.tl), daGui: !!r.submitted, giamSoVoiKyTruoc: !!r.giam }; }),
      xuHuong: { ghiChu: 'tỷ lệ giải ngân (%) theo thứ tự các kỳ từ cũ đến mới; kỳ tạm tính là số chưa chốt', cacKy: tr.cacKy, theoDonVi: tr.lines.slice(0, 90) }
    };
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, 110000);
    return fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ messages: [{ role: 'system', content: (o.kind === 'nhanh' ? SYS_NHANH : SYS) }, { role: 'user', content: 'Soạn phần nhận định và đề xuất cho báo cáo sau, dựa trên số liệu:\n' + JSON.stringify(ctx) }] })
    }).then(function (r) { return r.json().then(function (d) { clearTimeout(timer); if (!r.ok) throw new Error(d && d.error ? d.error : 'HTTP ' + r.status); return d; }); })
      .then(function (d) { if (!d.reply || !String(d.reply).trim()) throw new Error('AI không trả nội dung'); var txt = String(d.reply).trim(); try { if (o.kind === 'nhanh') txt = enforceChiDao(txt, chiDaoFlags(o.sources, tr.lines)); } catch (e) {} return txt; },
            function (e) { clearTimeout(timer); throw (e && e.name === 'AbortError' ? new Error('quá thời gian chờ') : e); });
  });
}

function box(text) {
  var html = String(text).replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\*\*/g, '').replace(/^#+\s*/, '').trim(); }).filter(Boolean).map(function (l) {
    if (/^\d\.\s+[^.]{2,60}$/.test(l)) return '<div style="margin-top:4px"><b>' + esc(l) + '</b></div>';
    if (/^[-*•]\s+/.test(l)) return '<div style="padding-left:10px">– ' + esc(l.replace(/^[-*•]\s+/, '')) + '</div>';
    return '<div>' + esc(l) + '</div>';
  }).join('');
  return '<div class="row"><div class="box" style="flex:1;border-color:#9fcdb8;background:#f7fbf9"><div class="t" style="color:#0b6b4f">Nhận định và đề xuất chuyên sâu (AI hỗ trợ)</div><div class="note">' + html +
    '<div style="margin-top:4px;font-size:7.8px;color:#6b7280"><i>Nội dung do AI hỗ trợ soạn từ số liệu hệ thống, mang tính tham khảo; cần rà soát, xác minh trước khi sử dụng.</i></div></div></div></div>';
}

window.gnAI = { assess: assess, box: box, loadingPage: loadingPage };
})();
