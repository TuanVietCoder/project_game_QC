// Đánh số phiên bản cho MỌI đường dẫn tới file JS/CSS — kể cả import bên trong
// module. Phải đồng bộ tuyệt đối: nếu một nơi ghi auth.js và nơi khác ghi
// auth.js?v=5 thì trình duyệt coi là hai module khác nhau và nạp auth.js hai lần.
const fs = require('fs');
const path = require('path');

const V = process.argv[2];
if (!V) { console.error('Dùng: node tools/phienban.js <số>'); process.exit(1); }

const GOC = path.resolve(__dirname, '..');
const JS = ['auth', 'app', 'chat'];
const CSS = ['base', 'app'];

const files = fs.readdirSync(GOC).filter((f) => f.endsWith('.html')).map((f) => f);
for (const f of fs.readdirSync(path.join(GOC, 'assets/js'))) files.push('assets/js/' + f);

let n = 0;
for (const rel of files) {
  const p = path.join(GOC, rel);
  let c = fs.readFileSync(p, 'utf8');
  const truoc = c;

  for (const j of JS) {
    // gỡ số cũ trước rồi gắn số mới, để chạy lại nhiều lần vẫn đúng
    c = c.replace(new RegExp(`(assets/js/${j}\\.js|\\./${j}\\.js)(\\?v=\\d+)?`, 'g'), `$1?v=${V}`);
  }
  for (const s of CSS) {
    c = c.replace(new RegExp(`(assets/css/${s}\\.css)(\\?v=\\d+)?`, 'g'), `$1?v=${V}`);
  }

  if (c !== truoc) { fs.writeFileSync(p, c); n++; }
}
console.log(`✓ đặt ?v=${V} cho JS và CSS ở ${n} file`);
