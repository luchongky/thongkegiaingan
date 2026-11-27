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
  aiRow.innerHTML = '<input type="checkbox" id="leaderAiChk" style="margin-top:2px"><span><b style="color:#0b6b4f">Thêm phần nhận định, đề xuất do AI hỗ trợ</b><br><span style="color:#6b7280">AI đọc số liệu các kỳ và soạn nhận định, giải pháp, nhắc nhở. Chờ khoảng 20–60 giây, mỗi lần dùng trừ 1 lượt AI trong tuần. Không áp dụng cho Mục VI.</span></span>';
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
      src: srcOf(u)
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
    out.push({ key: x[0], label: x[1], gi: gi, gn: gn, con: gi - gn, tl: pc(gn, gi) });
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
function barsQuick(rows, avg, tpc) {
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
  svg += '<text x="' + LBL + '" y="' + (hTot + 14) + '" font-size="7.2" fill="#1e3a5f">--- Bình quân tỉnh ' + pcTxt(avg) + '</text>';
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
function quickBySource(rows) {
  var h = '';
  rows.forEach(function (r, i) {
    var cls = r.tl < 50 ? 'lo' : r.tl >= 90 ? 'hi' : '';
    h += '<table class="t-src"><thead>' +
         '<tr class="uh"><th colspan="5">' + (i + 1) + '. ' + esc2(r.name) +
           ' <span class="uh-s">· Tổng: ' + n0(r.gn) + ' / ' + n0(r.gi) + ' · <span class="' + cls + '">' + pcTxt(r.tl) + '</span>' +
           (r.leader ? ' · Lãnh đạo: ' + esc2(r.leader) : '') + '</span></th></tr>' +
         '<tr class="ch"><th>Nguồn vốn</th><th class="r">Dự toán</th><th class="r">Đã giải ngân</th><th class="r">Còn lại</th><th class="r">Tỷ lệ</th></tr>' +
         '</thead><tbody>';
    if (!r.src.length) {
      h += '<tr><td colspan="5" class="c">Chưa có số liệu theo nguồn vốn</td></tr>';
    } else {
      r.src.forEach(function (x) {
        var c = x.gi <= 0 ? '' : x.tl < 50 ? 'lo' : x.tl >= 90 ? 'hi' : '';
        h += '<tr><td>' + esc2(x.label) + '</td><td class="r">' + n0(x.gi) + '</td><td class="r">' + n0(x.gn) + '</td>' +
             '<td class="r">' + n0(x.con) + '</td><td class="r b ' + c + '">' + (x.gi > 0 ? pcTxt(x.tl) : '—') + '</td></tr>';
      });
    }
    h += '</tbody></table>';
  });
  return h;
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
    '<div><div class="k">Tỷ lệ nhóm</div><div class="v big">' + pcTxt(tl) + '</div><div class="n">' + (tl >= avg ? 'cao hơn' : 'thấp hơn') + ' bình quân tỉnh</div></div>' +
    '<div><div class="k">Bình quân tỉnh</div><div class="v">' + pcTxt(avg) + '</div><div class="n">tiến độ thời gian ' + pcTxt(tpc) + '</div></div>' +
    '<div><div class="k">Nộp báo cáo</div><div class="v">' + rows.filter(function (r) { return r.submitted; }).length + '/' + rows.filter(function (r) { return r.submitted || !r.exempt; }).length + '</div><div class="n">' +
      (nhac ? chuaGui.length + ' đơn vị chưa gửi' : 'đã gửi đến thời điểm báo cáo') + '</div></div>' +
    '</div>';

  var chartHtml = '<div class="row"><div class="box" style="flex:1"><div class="t">Tỷ lệ giải ngân từng đơn vị (xếp theo tỷ lệ từ thấp đến cao)</div>' +
         barsQuick(rows, avg, tpc) + '</div></div>';
  if (rows.length <= 26) h += chartHtml;

  h += '<div class="row"><div class="box" style="flex:1"><div class="t">Nhận xét, đề nghị</div><div class="note">';
  h += '1. Tổng dự toán của ' + rows.length + ' đơn vị là <b>' + n0(gi) + ' triệu đồng</b>, đã giải ngân <b>' + n0(gn) +
       ' triệu đồng</b>, đạt <b>' + pcTxt(tl) + '</b>, ' + (tl >= avg ? 'cao hơn' : 'thấp hơn') + ' bình quân toàn tỉnh (' + pcTxt(avg) +
       ') và ' + (tl >= tpc ? 'bảo đảm' : 'chậm so với') + ' tiến độ thời gian (' + pcTxt(tpc) + ').<br>';
  var i = 2;
  h += i++ + '. Thấp hơn bình quân tỉnh: ' + (duoiBQ.length ? '<b>' + duoiBQ.length + ' đơn vị</b> – ' +
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
       quickBySource(rows);

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
    '.t-src th:first-child,.t-src td:first-child{width:43%}' +
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
    window.gnAI.assess({ kind: 'nhanh', title: 'Báo cáo nhanh – nhóm ' + rows0.length + ' đơn vị được chọn', period: per0.label || '', timePct: timePct(), rows: rows0 })
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
  aiLab.innerHTML = '<input type="checkbox" id="quickAiChk" style="margin-top:2px"><span><b style="color:#0b6b4f">Thêm phần nhận định, đề xuất do AI hỗ trợ</b> <span style="color:#6b7280">(chờ khoảng 20–60 giây, trừ 1 lượt AI trong tuần)</span></span>';
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
    btn.dispatchEvent(ev);
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


/* ============================================================
   AI HỖ TRỢ cho báo cáo lãnh đạo và báo cáo nhanh.
   AI soạn nhận định, giải pháp, nhắc nhở từ số liệu các kỳ; kết quả đặt trong khung riêng,
   ghi rõ là tham khảo, cần rà soát trước khi sử dụng. Người lập: Lục Hồng Kỳ
   ============================================================ */
(function () {
'use strict';
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function r1(v) { return v == null ? null : Math.round(v * 10) / 10; }

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
      body: JSON.stringify({ messages: [{ role: 'system', content: SYS }, { role: 'user', content: 'Soạn phần nhận định và đề xuất cho báo cáo sau, dựa trên số liệu:\n' + JSON.stringify(ctx) }] })
    }).then(function (r) { return r.json().then(function (d) { clearTimeout(timer); if (!r.ok) throw new Error(d && d.error ? d.error : 'HTTP ' + r.status); return d; }); })
      .then(function (d) { if (!d.reply || !String(d.reply).trim()) throw new Error('AI không trả nội dung'); return String(d.reply).trim(); },
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
