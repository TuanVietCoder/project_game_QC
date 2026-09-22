// =============================================================================
// Ashfall — khung dùng chung cho khu vực đã đăng nhập
// Mỗi trang gọi `const main = await dungKhung('ten-trang')`, nhận lại phần tử
// cột giữa rồi tự đổ nội dung vào. Thanh trên, menu và cột phải do đây lo.
// Phần nhìn nằm ở file app.css cạnh bên (thư mục assets/css).
// =============================================================================
import { supabase, getProfile, vietId, tenHienThi, signOut } from './auth.js?v=7';

export const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** Ảnh đại diện; không có ảnh thì lấy chữ cái đầu. */
export function veAva(p, cls = 'ash-ava') {
  const a = el('div', cls);
  if (p?.avatar_url) a.style.backgroundImage = `url("${String(p.avatar_url).replace(/"/g, '%22')}")`;
  else a.textContent = (p?.display_name || p?.username || '?').charAt(0).toUpperCase();
  return a;
}

/** "14:32" hôm nay, "Hôm qua", "T3", rồi "12/9" cho xa hơn. */
export function khiNao(iso) {
  if (!iso) return '';
  const d = new Date(iso), n = new Date();
  const ngay = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (ngay === 0) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (ngay === 1) return 'Hôm qua';
  if (ngay < 7) return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

const TRANG = [
  { ma: 'trang-chu', href: 'trang-chu.html', bieu: '🏠', ten: 'Trang chủ' },
  { ma: 'ho-so',     href: 'ho-so.html',     bieu: '👤', ten: 'Hồ sơ' },
  { ma: 'ban-be',    href: 'ban-be.html',    bieu: '👥', ten: 'Bạn bè' },
  { ma: 'quan-tri',  href: 'quan-tri.html',  bieu: '🛡️', ten: 'Quản trị', chiAdmin: true },
];

/**
 * Dựng thanh trên + menu + cột phải, trả về phần tử cột giữa.
 * Chưa đăng nhập thì tự chuyển sang trang đăng nhập.
 * @param {string} trangHienTai mã trang trong TRANG
 */
export async function dungKhung(trangHienTai) {
  const me = await getProfile();
  if (!me) { location.replace('dang-nhap.html'); throw new Error('chưa đăng nhập'); }

  const laQuanLy = ['admin', 'moderator'].includes(me.role);

  // ------------------------------------------------------------ thanh trên ---
  const top = el('header', 'ash-top');
  const brand = el('a', 'ash-top__brand');
  brand.href = 'trang-chu.html';
  brand.append(el('span', 'ash-top__mark'), el('span', 'ash-top__name', 'Ashfall'));
  const ava = veAva(me, 'ash-top__ava');
  ava.tabIndex = 0;
  ava.setAttribute('role', 'button');
  ava.setAttribute('aria-haspopup', 'menu');
  ava.setAttribute('aria-expanded', 'false');
  ava.setAttribute('aria-label', 'Tài khoản của bạn');
  top.append(brand, el('div', 'ash-top__sp'), ava);

  // ------------------------------------------------- thực đơn thả xuống ---
  const menu = el('div', 'ash-menu');
  menu.setAttribute('role', 'menu');
  menu.hidden = true;
  const who = el('div', 'ash-menu__who');
  who.append(el('div', 'ash-menu__ten', tenHienThi(me)), el('div', 'ash-menu__id', vietId(me)));
  menu.append(who);
  const mucHoSo = el('a', null, 'Hồ sơ của tôi'); mucHoSo.href = 'ho-so.html';
  const mucTrang = el('a', null, 'Trang giới thiệu game'); mucTrang.href = 'index.html';
  const nutThoat = el('button', 'thoat', 'Đăng xuất'); nutThoat.type = 'button';
  nutThoat.onclick = signOut;
  menu.append(mucHoSo, mucTrang, nutThoat);

  const doiMenu = (mo) => {
    menu.hidden = !mo;
    ava.setAttribute('aria-expanded', String(mo));
  };
  ava.onclick = () => doiMenu(menu.hidden);
  ava.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doiMenu(menu.hidden); } };
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== ava) doiMenu(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) doiMenu(false); });

  // ----------------------------------------------------------- ba cột ---
  const layout = el('div', 'ash-layout');
  const side = el('nav', 'ash-side');
  side.setAttribute('aria-label', 'Menu tài khoản');
  const nav = el('div', 'ash-nav');
  for (const t of TRANG) {
    if (t.chiAdmin && !laQuanLy) continue;
    const a = el('a');
    a.href = t.href;
    if (t.ma === trangHienTai) a.setAttribute('aria-current', 'page');
    a.append(el('span', 'bieu', t.bieu), el('span', null, t.ten));
    if (t.ma === 'ban-be') a.dataset.dem = 'ban-be';      // chỗ treo số lời mời
    nav.append(a);
  }
  side.append(nav);

  const main = el('main');
  const rail = el('aside', 'ash-rail');
  rail.setAttribute('aria-label', 'Bạn bè');

  layout.append(side, main, rail);
  document.body.append(top, menu, layout);

  // Cột phải và con số trên menu dùng chung MỘT lượt gọi danh_sach_ban.
  veQuanHe(rail, nav);

  return { main, rail, me };
}

/** Khung xương nhấp nháy trong lúc chờ mạng. */
export function veXuong(n = 3) {
  const hop = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const x = el('div', 'ash-xuong');
    const b = el('div', 'b');
    b.append(el('i'), el('i'));
    x.append(el('i', 'a'), b);
    hop.append(x);
  }
  return hop;
}

/** Cột phải (bạn bè) + số lời mời trên menu — một lượt gọi cho cả hai. */
async function veQuanHe(rail, nav) {
  const the = el('section', 'ash-the');
  const tieu = el('h2', null, 'Bạn bè');
  const hop = el('div');
  hop.append(veXuong());
  the.append(tieu, hop);
  rail.append(the);

  const { data, error } = await supabase.rpc('danh_sach_ban');
  if (error) { hop.replaceChildren(el('div', 'ash-trong', 'Không tải được danh sách bạn.')); return; }
  const ds = data || [];

  // số lời mời người khác gửi tới mình
  const cho = ds.filter((b) => b.status === 'pending' && !b.toi_gui).length;
  if (cho) nav.querySelector('[data-dem="ban-be"]')?.append(el('span', 'dem', String(cho)));

  const ban = ds.filter((b) => b.status === 'accepted');
  tieu.append(el('span', 'dem', String(ban.length)));
  if (!ban.length) {
    hop.replaceChildren(el('div', 'ash-trong', 'Chưa có bạn nào.'));
    the.append(Object.assign(el('a', 'ash-the__more', 'Tìm người chơi →'), { href: 'ban-be.html' }));
    return;
  }

  const manh = document.createDocumentFragment();
  for (const b of ban.slice(0, 8)) manh.append(hangNguoi(b, () => moChat(b.id)));
  hop.replaceChildren(manh);
  if (ban.length > 8) {
    the.append(Object.assign(el('a', 'ash-the__more', `Xem tất cả ${ban.length} bạn →`), { href: 'ban-be.html' }));
  }
}

/** Một hàng người chơi: ảnh, tên hiển thị, dòng phụ. */
export function hangNguoi(p, khiBam, phu) {
  const row = el(khiBam ? 'button' : 'div', 'ash-nguoi');
  if (khiBam) { row.type = 'button'; row.onclick = khiBam; }
  const meta = el('div', 'ash-nguoi__meta');
  const ten = tenHienThi(p);
  const duoi = phu ?? `${p.username}#${p.tag}`;
  meta.append(el('div', 'ash-nguoi__ten', ten));
  // chưa đặt tên hiển thị thì tenHienThi() rơi về Viet ID — khỏi in lại lần hai
  if (duoi !== ten) meta.append(el('div', 'ash-nguoi__phu', duoi));
  row.append(veAva(p), meta);
  return row;
}

/** Nhờ widget chat mở đúng cuộc trò chuyện. chat.js lắng nghe sự kiện này. */
export function moChat(banId) {
  window.dispatchEvent(new CustomEvent('ashfall:mo-chat', { detail: { banId } }));
}
