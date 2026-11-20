/**
 * Chat proxy for the dashboard.
 *
 * IMPORTANT: a fetch POST to an Apps Script web app does NOT reach doPost
 * with a JSON body. Google answers POST with an HTML sandbox page, so the
 * widget calls this with GET (?api=chat&question=...&context=...).
 * Add ONE line at the top of the project's existing doGet:
 *   if (e.parameter.api === 'chat') return doGetChat(e);
 * POST still works through doPostChat if the project's doPost routes
 * action 'chat' to it.
 *
 * Trial limit: 10 answered questions per day (Asia/Ho_Chi_Minh), counted in
 * Script Properties. A failed call to the AI does not consume a turn.
 */
var CHAT_DAILY_LIMIT = 10;

function chatDailyKey_() {
  var today = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
  return 'CHAT_COUNT_' + today;
}

function handleChat(question, context) {
  var props = PropertiesService.getScriptProperties();
  var used = parseInt(props.getProperty(chatDailyKey_()) || '0', 10) || 0;
  if (used >= CHAT_DAILY_LIMIT) {
    return chatJson({error: 'Bản thử nghiệm đã hết 10 lượt hỏi hôm nay. Vui lòng quay lại ngày mai.', remaining: 0});
  }
  var key = props.getProperty('XINGCHI_API_KEY');
  if (!key) return chatJson({error: 'Chưa cấu hình key.'});
  var q = String(question || '').slice(0, 4000);
  var ctx = String(context || '').slice(0, 4000);
  try {
    var response = UrlFetchApp.fetch('https://api.xingchiapi.com/v1/responses', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: {Authorization: 'Bearer ' + key},
      payload: JSON.stringify({model: 'gpt-6.1-sol', instructions: 'Bạn là trợ lý giải ngân vốn thường xuyên tỉnh Cao Bằng. Trả lời ngắn gọn, chỉ dùng số liệu trong context được đưa, không bịa số. Nếu thiếu số liệu thì nói rõ chưa có số liệu.', input: q + '\n\nContext:\n' + ctx, max_output_tokens: 600})
    });
    var body = JSON.parse(response.getContentText());
    var answer = body.answer || body.output_text || (body.output && body.output[0] && body.output[0].content && body.output[0].content[0] && body.output[0].content[0].text);
    if (!answer) throw new Error('empty');
    props.setProperty(chatDailyKey_(), String(used + 1));
    return chatJson({answer: String(answer), remaining: CHAT_DAILY_LIMIT - used - 1});
  } catch (err) { return chatJson({error: 'Không thể nhận phản hồi từ trợ lý.'}); }
}

function doGetChat(e) {
  var p = (e && e.parameter) || {};
  return handleChat(p.question, p.context);
}

function doPostChat(e) {
  var json;
  try { json = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return chatJson({error: 'Dữ liệu gửi lên không hợp lệ.'}); }
  if (json.action !== 'chat') return chatJson({error: 'Yêu cầu không được hỗ trợ.'});
  return handleChat(json.question, json.context);
}

function chatJson(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
