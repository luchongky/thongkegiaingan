/**
 * Chat proxy for the dashboard.
 * If the Apps Script project already has doPost, call doPostChat(e) from it
 * when action is 'chat'. If it has no doPost, rename doPostChat to doPost.
 */
function doPostChat(e) {
  var json;
  try { json = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return chatJson({error: 'Dữ liệu gửi lên không hợp lệ.'}); }
  if (json.action !== 'chat') return chatJson({error: 'Yêu cầu không được hỗ trợ.'});
  var key = PropertiesService.getScriptProperties().getProperty('XINGCHI_API_KEY');
  if (!key) return chatJson({error: 'Chưa cấu hình key.'});
  var question = String(json.question || '').slice(0, 4000);
  var context = String(json.context || '').slice(0, 4000);
  try {
    var response = UrlFetchApp.fetch('https://api.xingchiapi.com/v1/responses', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: {Authorization: 'Bearer ' + key},
      payload: JSON.stringify({model: 'gpt-6.1-sol', instructions: 'Bạn là trợ lý giải ngân vốn thường xuyên tỉnh Cao Bằng. Trả lời ngắn gọn, chỉ dùng số liệu trong context được đưa, không bịa số. Nếu thiếu số liệu thì nói rõ chưa có số liệu.', input: question + '\n\nContext:\n' + context, max_output_tokens: 600})
    });
    var body = JSON.parse(response.getContentText());
    var answer = body.answer || body.output_text || (body.output && body.output[0] && body.output[0].content && body.output[0].content[0] && body.output[0].content[0].text);
    if (!answer) throw new Error('empty');
    return chatJson({answer: String(answer)});
  } catch (err) { return chatJson({error: 'Không thể nhận phản hồi từ trợ lý.'}); }
}
function chatJson(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
