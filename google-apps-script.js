function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var name = data.name || 'Unknown';
    var timestamp = data.timestamp || new Date().toISOString();

    var sheetName = 'Birthday RSVPs';
    var ss = getOrCreateSheet(sheetName);
    var sheet = ss.getSheets()[0];

    sheet.appendRow([name, timestamp, new Date()]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(name) {
  var files = DriveApp.getFilesByName(name);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  var ss = SpreadsheetApp.create(name);
  var sheet = ss.getSheets()[0];
  sheet.appendRow(['Name', 'RSVP Time', 'Logged At']);
  sheet.getRange('1:1').setFontWeight('bold');
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 200);
  return ss;
}

function testDoPost() {
  var e = {
    postData: {
      contents: JSON.stringify({ name: 'Test User', timestamp: new Date().toISOString() })
    }
  };
  var result = doPost(e);
  Logger.log(result.getContent());
}
