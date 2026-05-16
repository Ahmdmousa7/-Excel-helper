const fs = require('fs');
const file = './components/VariableBalanceTab.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `                              {language === 'ar' ? (
                                  <>
                                      <li><strong>Balanced List:</strong> القائمة الكاملة مع الصفوف المضافة.</li>
                                      <li><strong>Summary:</strong> ملخص حالة كل منتج (متوازن/غير متوازن).</li>
                                      <li><strong>Final Ready:</strong> نسخة نظيفة وجاهزة للاستيراد.</li>
                                  </>
                              ) : (
                                  <>
                                      <li><strong>Balanced List:</strong> Full list including generated missing rows.</li>
                                      <li><strong>Summary:</strong> Status overview for each product group.</li>
                                      <li><strong>Final Ready:</strong> Clean, deduplicated version for import.</li>
                                  </>
                              )}`;

const replacement = `                              {language === 'ar' ? (
                                  <>
                                      <li><strong>Detailed Action Report:</strong> المنتجات التي تم التعديل عليها أو إضافة متغيرات لها.</li>
                                      <li><strong>Summary:</strong> ملخص حالة كل منتج (متوازن/غير متوازن).</li>
                                      <li><strong>Final Ready:</strong> القائمة الكاملة النهائية الجاهزة للاستيراد.</li>
                                  </>
                              ) : (
                                  <>
                                      <li><strong>Detailed Action Report:</strong> Products that had missing variants added or errors fixed.</li>
                                      <li><strong>Summary:</strong> Status overview for each product group.</li>
                                      <li><strong>Final Ready:</strong> Clean, final complete list ready for import.</li>
                                  </>
                              )}`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Replaced!");
} else {
    // try to regex replace it
    const startStr = "{language === 'ar' ? (";
    const endStr = ")}";
    const startIdx = content.indexOf(startStr, content.indexOf("Export Content"));
    const endIdx = content.indexOf(endStr, startIdx);
    if (startIdx !== -1 && endIdx !== -1) {
        content = content.substring(0, startIdx) + replacement.trim() + content.substring(endIdx + 2);
        fs.writeFileSync(file, content, 'utf8');
        console.log("Regex replaced!");
    } else {
        console.log("Could not find target strings");
        process.exit(1);
    }
}
