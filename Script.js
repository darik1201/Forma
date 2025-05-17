function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let fileUrl = '';
    let fileBlob = null;

    if (data.fileData?.data) {
      const folder = DriveApp.getFolderById('YOUR-DRIVE-ID');
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data.fileData.data),
        data.fileData.type,
        data.fileData.name
      );
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
      fileBlob = file.getBlob();
    }

    const cityPrice = {
      "Калининград": 47500,
      "Москва": 51000,
      "Самостоятельно": 51000
    };
    const finalPrice = cityPrice[data.option] || 0;

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const today = new Date();
    const currentDate = Utilities.formatDate(today, Session.getScriptTimeZone(), "dd.MM.yyyy");

    const lastRow = sheet.getLastRow();
    const lastContractNumber = lastRow > 0 ? sheet.getRange(lastRow, 13).getValue() : "";
    const numericPart = lastContractNumber ? parseInt(lastContractNumber.match(/\d+/)) + 1 : 1;

    const cityCode = data.option === "Москва" ? "М" : data.option === "Калининград" ? "К" : "С";
    const contractNumber = "Т" + String(numericPart).padStart(3, '0') + cityCode;

    const rowData = [
      data.parentsname,
      data.passport,
      data.passportinfo,
      data.passportadres,
      data.childrenname,
      data.birthday,
      data.documentchildren,
      fileUrl,
      data.option,
      data.number,
      data.email,
      contractNumber,
      currentDate
    ];

    sheet.appendRow(rowData);

    const templateDocId = "YOUR-DOCUMENT-ID";
    const copyDocName = `Договор ${contractNumber} от ${currentDate} для ${data.parentsname}`;
    const copyDoc = DriveApp.getFileById(templateDocId).makeCopy(copyDocName);
    const doc = DocumentApp.openById(copyDoc.getId());
    const body = doc.getBody();

    const placeholders = {
      "{{parentsname}}": data.parentsname,
      "{{passport}}": data.passport,
      "{{city}}": data.option === "Самостоятельно" ? "Москва" : data.option,
      "{{passportinfo}}": data.passportinfo,
      "{{passportadres}}": data.passportadres,
      "{{childrenname}}": data.childrenname,
      "{{birthday}}": data.birthday,
      "{{documentchildren}}": data.documentchildren,
      "{{documentscan}}": fileUrl,
      "{{contractNumber}}": contractNumber,
      "{{currentDate}}": currentDate,
      "{{number}}": data.number,
      "{{email}}": data.email
    };

    Object.entries(placeholders).forEach(([key, value]) => {
      body.replaceText(key, value);
    });

    doc.saveAndClose();

    const secondTemplateDocId = "YOUR-DOCUMENT-ID";
    const secondCopyDocName = `Дополнительный договор ${contractNumber} от ${currentDate} для ${data.parentsname}`;
    const secondCopyDoc = DriveApp.getFileById(secondTemplateDocId).makeCopy(secondCopyDocName);
    const secondDoc = DocumentApp.openById(secondCopyDoc.getId());
    const secondBody = secondDoc.getBody();

    const secondPlaceholders = {
      ...placeholders,
      "{{city}}": data.option === "Самостоятельно" ? "Москва" : data.option,
      "{{finalPrice}}": finalPrice
    };

    Object.entries(secondPlaceholders).forEach(([key, value]) => {
      secondBody.replaceText(key, value);
    });

    secondDoc.saveAndClose();

    const pdfBlob = DriveApp.getFileById(copyDoc.getId()).getAs(MimeType.PDF);
    const secondPdfBlob = DriveApp.getFileById(secondCopyDoc.getId()).getAs(MimeType.PDF);
    const pdfBlob1 = DriveApp.getFileById('YOUR-DOCUMENT-ID').getAs(MimeType.PDF);

    GmailApp.sendEmail(
      data.email,
      `Договор ${contractNumber} от ${currentDate}`,
      `Здравствуйте, ${data.parentsname}!\n\nВаш договор прикреплен к этому письму.\n\nОбратите внимание на пункты\n5.1.3\n5.3.1\n5.3.2\n6\nСсылку на оплату вышлем дополнительно! Ожидайте`,
      {
        attachments: [pdfBlob, pdfBlob1],
        name: 'Служба поддержки'
      }
    );

    if (fileBlob) {
      const attachments = [pdfBlob, secondPdfBlob, pdfBlob1, fileBlob];

      GmailApp.sendEmail(
        "admin-email",
        `НОВЫЙ ДОГОВОР ${contractNumber} от ${currentDate}`,
        `Данные клиента:\n` +
        `ФИО родителя: ${data.parentsname}\n` +
        `ФИО ребенка: ${data.childrenname}\n` +
        `Телефон: ${data.number}\n` +
        `Email: ${data.email}\n`,
        {
          attachments: attachments,
          name: 'Система уведомлений'
        }
      );
    }

    return ContentService.createTextOutput("Данные успешно отправлены! Договор создан и отправлен на почту.")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function extractFileIdFromUrl(url) {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)\//);
  return match ? match[1] : null;
}