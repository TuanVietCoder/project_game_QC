// =============================================================================
// Ashfall — hộp chat nổi (kiểu Facebook)
// Tự gắn vào mọi trang có nạp file này. Chỉ hiện khi đã đăng nhập.
// Nạp bằng thẻ <script type="module"> trỏ tới file này, nhớ kèm ?v= giống các trang khác.
// =============================================================================
import { supabase, getProfile, tenHienThi, dichLoi } from './auth.js?v=8';

const CSS = `
.ash-chat, .ash-chat * { box-sizing:border-box; }
.ash-chat{
  position:fixed; right:18px; bottom:18px; z-index:2000;
  font-family:var(--font-body, sans-serif);
}
.ash-chat__fab{
  width:56px; height:56px; border-radius:50%; border:none; cursor:pointer;
  background:var(--ember,#ff9d47); color:#1a1208; font-size:24px; line-height:1;
  box-shadow:0 8px 26px rgba(0,0,0,.45); position:relative;
  display:grid; place-items:center; transition:transform .16s ease;
}
.ash-chat__fab:hover{ transform:scale(1.06); }
.ash-chat__dot{
  position:absolute; top:-3px; right:-3px; min-width:21px; height:21px; padding:0 6px;
  border-radius:999px; background:var(--crack,#cf4b3e); color:#fff;
  font:700 11px/21px var(--font-mono,monospace); text-align:center;
  border:2px solid var(--bg,#100d0a);
}
.ash-chat__panel{
  position:absolute; right:0; bottom:68px; width:344px; height:min(72vh,486px);
  display:flex; flex-direction:column; overflow:hidden;
  background:var(--bg-plate,#1a1510); border:1px solid var(--line-strong,#3a332c);
  border-radius:16px; box-shadow:0 20px 56px rgba(0,0,0,.62);
  transform-origin:bottom right;
}
@media (prefers-reduced-motion:no-preference){
  .ash-chat__panel{ animation:ash-panel-in .18s cubic-bezier(.16,1,.3,1); }
}
@keyframes ash-panel-in{
  from{ opacity:0; transform:translateY(10px) scale(.97); }
  to{ opacity:1; transform:none; }
}

.ash-chat__head{
  display:flex; align-items:center; gap:2px; padding:12px 8px 12px 16px;
  border-bottom:1px solid var(--line,#2a241f); flex:none;
  background:linear-gradient(180deg, rgba(255,157,71,.06), transparent);
}
.ash-chat__head b{
  flex:1; font-size:14.5px; color:var(--ink,#efe6d4); font-weight:600;
  letter-spacing:.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.ash-chat__icon{
  background:none; border:none; cursor:pointer; color:var(--muted,#a99a82);
  font-size:15px; line-height:1; width:30px; height:30px; border-radius:8px;
  display:grid; place-items:center; flex:none;
  transition:background .14s ease, color .14s ease;
}
.ash-chat__icon:hover{ color:var(--ink,#efe6d4); background:rgba(255,255,255,.07); }

.ash-chat__body{ flex:1; overflow-y:auto; padding:6px; scrollbar-width:thin;
  scrollbar-color:var(--line-strong,#3a332c) transparent; }
.ash-chat__body::-webkit-scrollbar{ width:8px; }
.ash-chat__body::-webkit-scrollbar-thumb{
  background:var(--line-strong,#3a332c); border-radius:99px;
  border:2px solid var(--bg-plate,#1a1510);
}

.ash-chat__row{
  display:flex; align-items:center; gap:11px; width:100%; text-align:left;
  background:none; border:none; cursor:pointer; padding:9px 10px; border-radius:11px;
  color:inherit; transition:background .14s ease;
}
.ash-chat__row:hover{ background:rgba(255,255,255,.055); }
.ash-chat__ava{
  width:40px; height:40px; flex:none; border-radius:50%;
  border:1.5px solid var(--ember-dim,#c97a38);
  background:var(--bg-plate-2,#221b14) center/cover no-repeat;
  display:grid; place-items:center;
  font:700 15px var(--font-display,serif); color:var(--ember,#ff9d47);
}
.ash-chat__meta{ flex:1; min-width:0; }
.ash-chat__top{ display:flex; align-items:baseline; gap:8px; }
.ash-chat__name{
  flex:1; min-width:0; font-size:13.5px; color:var(--ink,#efe6d4); font-weight:600;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.ash-chat__khi{ flex:none; font:500 10.5px var(--font-mono,monospace); color:var(--muted-2,#75695a); }
.ash-chat__last{
  font-size:12.5px; color:var(--muted-2,#75695a); margin-top:1px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.ash-chat__row[data-unread="1"] .ash-chat__last{ color:var(--ink,#efe6d4); font-weight:600; }
.ash-chat__row[data-unread="1"] .ash-chat__khi{ color:var(--ember,#ff9d47); }
.ash-chat__n{
  flex:none; min-width:19px; height:19px; padding:0 5px; border-radius:999px;
  background:var(--crack,#cf4b3e); color:#fff; font:700 10px/19px var(--font-mono,monospace);
  text-align:center;
}

/* khung xương lúc đang tải — để panel không mở ra trống trơn */
.ash-chat__xuong{ display:flex; align-items:center; gap:11px; padding:9px 10px; }
.ash-chat__xuong i{ display:block; border-radius:99px; background:rgba(255,255,255,.055); }
.ash-chat__xuong .a{ width:40px; height:40px; border-radius:50%; flex:none; }
.ash-chat__xuong .b{ flex:1; }
.ash-chat__xuong .b i:first-child{ height:11px; width:58%; margin-bottom:7px; }
.ash-chat__xuong .b i:last-child{ height:9px; width:82%; }
@media (prefers-reduced-motion:no-preference){
  .ash-chat__xuong i{ animation:ash-tho 1.3s ease-in-out infinite; }
}
@keyframes ash-tho{ 0%,100%{ opacity:.5; } 50%{ opacity:1; } }

.ash-chat__msgs{ display:flex; flex-direction:column; gap:7px; padding:12px; }
.ash-chat__b{
  max-width:78%; padding:9px 13px; border-radius:15px; font-size:13.5px; line-height:1.5;
  word-wrap:break-word; overflow-wrap:anywhere; position:relative;
}
.ash-chat__b--me{ align-self:flex-end; background:var(--ember,#ff9d47); color:#1a1208; border-bottom-right-radius:5px; }
.ash-chat__b--them{ align-self:flex-start; background:var(--bg-plate-2,#221b14); color:var(--ink,#efe6d4); border-bottom-left-radius:5px; }
.ash-chat__b--go{ font-style:italic; opacity:.65; }
.ash-chat__time{ display:block; margin-top:3px; font-size:10px; opacity:.6; }
.ash-chat__tools{ display:flex; gap:8px; margin-top:4px; }
.ash-chat__tool{
  background:none; border:none; cursor:pointer; padding:0;
  font:600 10px var(--font-mono,monospace); letter-spacing:.05em;
  text-transform:uppercase; opacity:.6; color:inherit;
}
.ash-chat__tool:hover{ opacity:1; text-decoration:underline; }

.ash-chat__form{ display:flex; gap:8px; padding:10px; border-top:1px solid var(--line,#2a241f); flex:none; }
.ash-chat__form textarea{
  flex:1; resize:none; max-height:90px; padding:9px 12px; border-radius:18px;
  background:var(--bg-plate-2,#221b14); color:var(--ink,#efe6d4);
  border:1px solid var(--line-strong,#3a332c);
  font-family:inherit; font-size:13.5px; line-height:1.45;
}
.ash-chat__form textarea:focus{ outline:none; border-color:var(--ember-dim,#c97a38); }
.ash-chat__send{
  flex:none; width:38px; height:38px; align-self:flex-end; border:none; border-radius:50%;
  background:var(--ember,#ff9d47); color:#1a1208; cursor:pointer; font-size:16px;
}
.ash-chat__send:disabled{ opacity:.45; cursor:default; }

.ash-chat__empty{ padding:40px 24px; text-align:center; color:var(--muted-2,#75695a);
  font-size:12.5px; line-height:1.75; white-space:pre-line; }
.ash-chat__thulai{
  display:block; margin:14px auto 0; cursor:pointer;
  background:none; color:var(--ember,#ff9d47);
  border:1px solid var(--ember-dim,#c97a38); border-radius:999px; padding:7px 16px;
  font:700 10px var(--font-mono,monospace); letter-spacing:.1em; text-transform:uppercase;
}
.ash-chat__thulai:hover{ background:rgba(255,157,71,.1); }
.ash-chat__err{
  margin:8px; padding:9px 11px; border-radius:8px; font-size:12px;
  background:rgba(207,75,62,.14); border:1px solid var(--crack,#cf4b3e); color:#f0b3ac;
}
/* GỐC RỄ của lỗi khung chat không tắt được: .ash-chat__panel đặt display:flex và
   .ash-chat__icon đặt display:grid — cả hai đè lên [hidden] của trình duyệt, nên
   panel.hidden = true chẳng có tác dụng gì. Bắt buộc phải !important. */
.ash-chat[hidden], .ash-chat [hidden]{ display:none !important; }

/* --------------------------------------------- khách chưa đăng nhập --- */
/* Vài hàng người mờ mờ làm nền, rồi phủ lời mời đăng nhập lên trên. */
.ash-chat__mo{ position:relative; min-height:100%; }
.ash-chat__mo .ash-chat__xuong{ opacity:.5; }
.ash-chat__moi{
  position:absolute; inset:0;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:11px; padding:22px; text-align:center;
  /* trong suốt ở trên để còn thấy mấy hàng người trống, rồi mờ dần xuống đặc */
  background:linear-gradient(180deg,
    transparent 0%, rgba(26,21,16,.55) 20%, rgba(26,21,16,.92) 36%, var(--bg-plate,#1a1510) 50%);
}
.ash-chat__moi .khoa{ font-size:27px; line-height:1; }
.ash-chat__moi b{ font-size:14.5px; color:var(--ink,#efe6d4); font-weight:600; }
.ash-chat__moi p{ margin:0; font-size:12.5px; line-height:1.65; color:var(--muted-2,#75695a); max-width:250px; }
.ash-chat__moi a{
  margin-top:4px; padding:10px 22px; border-radius:9px; text-decoration:none;
  background:var(--ember,#ff9d47); color:#1a1208;
  font:700 11px var(--font-mono,monospace); letter-spacing:.11em; text-transform:uppercase;
}
.ash-chat__moi a:hover{ filter:brightness(1.1); text-decoration:none; }

/* ---------------------------------------------------- thông báo nổi --- */
.ash-toasts{
  position:fixed; right:18px; bottom:86px; z-index:2001;
  display:flex; flex-direction:column-reverse; gap:9px;
  max-width:min(320px, calc(100vw - 36px)); pointer-events:none;
}
.ash-toast{
  display:flex; align-items:center; gap:11px; padding:11px 13px;
  background:var(--bg-plate,#1a1510); border:1px solid var(--line-strong,#3a332c);
  border-left:3px solid var(--ember,#ff9d47); border-radius:11px;
  box-shadow:0 12px 34px rgba(0,0,0,.5); cursor:pointer; pointer-events:auto;
  animation:ash-toast-in .22s ease-out;
  font-family:var(--font-body,sans-serif);
}
.ash-toast:hover{ border-color:var(--ember-dim,#c97a38); }
.ash-toast--di{ animation:ash-toast-out .2s ease-in forwards; }
@keyframes ash-toast-in{ from{ opacity:0; transform:translateX(24px); } to{ opacity:1; transform:none; } }
@keyframes ash-toast-out{ to{ opacity:0; transform:translateX(24px); } }
@media (prefers-reduced-motion:reduce){
  .ash-toast, .ash-toast--di{ animation:none; }
}
.ash-toast__x{
  flex:none; background:none; border:none; cursor:pointer; align-self:flex-start;
  color:var(--muted-2,#75695a); font-size:14px; line-height:1; padding:2px 3px;
}
.ash-toast__x:hover{ color:var(--ink,#efe6d4); }

@media (max-width:600px){
  /* trên điện thoại khung nổi quá chật — cho chiếm trọn màn hình như Messenger */
  .ash-chat__panel{
    position:fixed; left:0; right:0; top:0; bottom:auto;
    width:auto; height:100dvh; border-radius:0; border:none;
    padding-top:env(safe-area-inset-top);
    padding-bottom:env(safe-area-inset-bottom);
    transform-origin:center;
  }
  .ash-chat__panel:not([hidden]) ~ .ash-chat__fab{ display:none; }
  .ash-chat__head{ padding:10px 6px 10px 12px; }
  .ash-chat__head b{ font-size:16px; }
  .ash-chat__icon{ width:40px; height:40px; font-size:17px; }
  .ash-chat__body{ padding:4px; }
  .ash-chat__row{ padding:11px 12px; }
  .ash-chat__name{ font-size:15px; }
  .ash-chat__last{ font-size:13px; }
  .ash-chat__b{ max-width:85%; font-size:15px; }
  .ash-chat__form{ padding:8px 10px; }
  /* dưới 16px thì Safari iOS tự phóng to trang mỗi lần bấm vào ô nhập */
  .ash-chat__form textarea{ font-size:16px; max-height:120px; }
  .ash-chat__send{ width:42px; height:42px; }
  .ash-toasts{ right:12px; left:12px; max-width:none; bottom:82px; }
}
`;

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const gio = (iso) =>
  new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** "14:32" nếu hôm nay, "Hôm qua", "T3", rồi "12/9" — kiểu Facebook. */
function khiNao(iso) {
  const d = new Date(iso);
  const nay = new Date();
  const ngay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const lech = Math.round((ngay(nay) - ngay(d)) / 86400000);
  if (lech === 0) return gio(iso);
  if (lech === 1) return 'Hôm qua';
  if (lech < 7) return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
}
const chuCai = (p) => (p.display_name || p.username || '?').charAt(0).toUpperCase();

// =========================================================== thông báo ===
// Bốn lớp, xếp từ chắc chắn nhất tới cần xin phép:
//   1. Tiêu đề tab "(2) Ashfall…"  — luôn chạy
//   2. Thẻ nổi trong trang          — luôn chạy
//   3. Tiếng "ding"                 — cần người dùng bấm chuột một lần (luật trình duyệt)
//   4. Thông báo hệ điều hành       — cần cấp quyền, chỉ hiện khi tab đang ẩn
const KHOA_AM = 'ashfall_chat_am_thanh';
const amBat = () => localStorage.getItem(KHOA_AM) !== '0';
const datAm = (bat) => localStorage.setItem(KHOA_AM, bat ? '1' : '0');

const TIEU_DE_GOC = document.title;
function datTieuDe(n) {
  document.title = n > 0 ? `(${n}) ${TIEU_DE_GOC}` : TIEU_DE_GOC;
}

// Trình duyệt chặn phát tiếng trước khi người dùng tương tác, nên chỉ dựng
// AudioContext sau cú bấm chuột đầu tiên.
let am = null;
const dungAm = () => {
  if (am) { am.resume?.(); return; }
  try { am = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* không sao */ }
};
document.addEventListener('click', dungAm, { once: true });
document.addEventListener('keydown', dungAm, { once: true });

function keu() {
  if (!amBat() || !am || am.state !== 'running') return;
  try {
    const t = am.currentTime;
    const o = am.createOscillator();
    const g = am.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1175, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(am.destination);
    o.start(t);
    o.stop(t + 0.32);
  } catch { /* không sao */ }
}

const coQuyenThongBao = () =>
  'Notification' in window && Notification.permission === 'granted';

function thongBaoHeThong(ban, noiDung, khiBam) {
  if (!coQuyenThongBao() || !document.hidden) return;   // đang xem trang thì thẻ nổi là đủ
  try {
    const n = new Notification(tenHienThi(ban), {
      body: noiDung,
      icon: new URL('../tuanviet-studio-logo.jpg', import.meta.url).href,
      tag: 'ashfall-' + ban.id,                          // tin sau đè tin trước của cùng người
    });
    n.onclick = () => { window.focus(); n.close(); khiBam(); };
  } catch { /* không sao */ }
}

/**
 * Khách chưa đăng nhập vẫn thấy nút chat, bấm vào thì hiện lời mời đăng nhập.
 * Dựng riêng một khung tối giản thay vì nhét cờ "khách" vào cả widget thật —
 * ở đây không có dữ liệu, không realtime, không gì để giữ trạng thái.
 */
function khungKhach() {
  const root = el('div', 'ash-chat');
  const fab = el('button', 'ash-chat__fab', '💬');
  fab.type = 'button';
  fab.title = 'Tin nhắn';
  fab.setAttribute('aria-label', 'Mở tin nhắn');

  const panel = el('div', 'ash-chat__panel');
  panel.hidden = true;
  const head = el('div', 'ash-chat__head');
  const dong = el('button', 'ash-chat__icon', '✕');
  dong.type = 'button';
  dong.title = 'Đóng';
  head.append(el('b', null, 'Tin nhắn'), dong);

  const body = el('div', 'ash-chat__body');
  const mo = el('div', 'ash-chat__mo');
  const nen = el('div');
  nen.setAttribute('aria-hidden', 'true');          // chỉ để nhìn, trình đọc bỏ qua
  nen.append(veHangTrong(4));
  mo.append(nen);

  const moi = el('div', 'ash-chat__moi');
  moi.append(el('div', 'khoa', '🔒'));
  moi.append(el('b', null, 'Đăng nhập để trò chuyện'));
  moi.append(el('p', null, 'Kết bạn với người chơi khác và nhắn tin ngay trên web. Tạo tài khoản mất chưa tới một phút.'));
  const vao = el('a', null, 'Đăng nhập');
  vao.href = 'dang-nhap.html';
  moi.append(vao);
  mo.append(moi);
  body.append(mo);

  panel.append(head, body);
  root.append(panel, fab);
  document.body.append(root);

  const doi = (hien) => { panel.hidden = !hien; };
  fab.onclick = () => doi(panel.hidden);
  dong.onclick = () => doi(false);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) doi(false); });
  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !root.contains(e.target)) doi(false);
  });
}

/** Mấy hàng xương xám làm nền cho màn mời đăng nhập (widget thật có bản riêng). */
function veHangTrong(n) {
  const hop = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const x = el('div', 'ash-chat__xuong');
    const b = el('div', 'b');
    b.append(el('i'), el('i'));
    x.append(el('i', 'a'), b);
    hop.append(x);
  }
  return hop;
}

async function init() {
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));

  const me = await getProfile();
  if (!me) { khungKhach(); return; }                // khách: chỉ lời mời đăng nhập

  // ------------------------------------------------------------ khung ---
  const root = el('div', 'ash-chat');
  const fab = el('button', 'ash-chat__fab');
  fab.type = 'button';
  fab.textContent = '💬';
  fab.title = 'Tin nhắn';
  fab.setAttribute('aria-label', 'Mở tin nhắn');
  const dot = el('span', 'ash-chat__dot');
  dot.hidden = true;

  const panel = el('div', 'ash-chat__panel');
  panel.hidden = true;
  const head = el('div', 'ash-chat__head');
  const back = el('button', 'ash-chat__icon', '←');
  back.type = 'button'; back.hidden = true; back.title = 'Quay lại';
  const title = el('b', null, 'Tin nhắn');

  const chuong = el('button', 'ash-chat__icon');
  chuong.type = 'button';
  const veChuong = () => {
    if (!('Notification' in window)) { chuong.hidden = true; return; }
    const p = Notification.permission;
    chuong.textContent = p === 'granted' ? '🔔' : p === 'denied' ? '🔕' : '🔔';
    chuong.style.opacity = p === 'granted' ? '1' : '.45';
    chuong.title = p === 'granted'
      ? 'Thông báo hệ thống đang bật'
      : p === 'denied'
        ? 'Bạn đã chặn thông báo cho trang này — mở cài đặt trình duyệt để bật lại'
        : 'Bật thông báo khi có tin nhắn mới';
  };
  chuong.onclick = async () => {
    if (Notification.permission === 'default') await Notification.requestPermission();
    veChuong();
  };
  veChuong();

  const loa = el('button', 'ash-chat__icon');
  loa.type = 'button';
  const veLoa = () => {
    loa.textContent = amBat() ? '🔊' : '🔇';
    loa.title = amBat() ? 'Tắt tiếng báo' : 'Bật tiếng báo';
  };
  loa.onclick = () => { datAm(!amBat()); veLoa(); dungAm(); keu(); };
  veLoa();

  const close = el('button', 'ash-chat__icon', '✕');
  close.type = 'button'; close.title = 'Đóng';
  head.append(back, title, chuong, loa, close);
  const body = el('div', 'ash-chat__body');
  panel.append(head, body);

  fab.append(dot);
  root.append(panel, fab);
  const khayToast = el('div', 'ash-toasts');
  document.body.append(root, khayToast);

  // ------------------------------------------------------------- state ---
  let dsHoiThoai = [];
  let dangMo = null;          // hồ sơ người đang nhắn, null = đang ở danh sách
  let dangXem = false;
  let phien = 0;              // tăng mỗi khi đổi màn; kết quả cũ về sau sẽ bị bỏ

  const loi = (text) => {
    const e = el('div', 'ash-chat__err', text);
    body.prepend(e);
    setTimeout(() => e.remove(), 6000);
  };

  // --------------------------------------------------- danh sách bạn ---
  // Gộp các lời gọi trùng nhau: nếu đang tải dở thì dùng chung kết quả đó,
  // tránh việc mỗi tin nhắn đến lại bắn thêm một lượt mạng.
  let _dangTai = null;
  function taiDanhSach() {
    if (_dangTai) return _dangTai;
    _dangTai = (async () => {
      try {
        const { data, error } = await supabase.rpc('danh_sach_hoi_thoai');
        if (error) { loi(dichLoi(error.message)); return; }
        dsHoiThoai = data || [];
        capNhatChuongBao();
        if (dangXem && !dangMo) veDanhSach();
      } finally { _dangTai = null; }
    })();
    return _dangTai;
  }

  /** Cập nhật tại chỗ khi có tin mới — khỏi phải hỏi lại máy chủ. */
  function vaDanhSach(m, cuaToi) {
    const doiPhuong = cuaToi ? m.recipient_id : m.sender_id;
    const i = dsHoiThoai.findIndex((r) => r.id === doiPhuong);
    if (i < 0) { taiDanhSach(); return; }          // bạn mới, đành tải lại
    const r = dsHoiThoai[i];
    r.tin_cuoi = m.body;
    r.tin_cuoi_cua_toi = cuaToi;
    r.thoi_gian = m.created_at;
    if (!cuaToi) r.chua_doc = Number(r.chua_doc || 0) + 1;
    dsHoiThoai.splice(i, 1);
    dsHoiThoai.unshift(r);                         // đẩy lên đầu như Facebook
    capNhatChuongBao();
    if (dangXem && !dangMo) veDanhSach();
  }

  /**
   * Báo lên máy chủ là đã đọc hết tin của người này. Không chờ kết quả, nhưng
   * BẮT BUỘC phải .then(): supabase.rpc() trả về builder chứ không phải Promise,
   * và nó chỉ thật sự gọi fetch bên trong then(). Viết trần một dòng
   * `supabase.rpc(...)` thì không có request nào được gửi đi cả.
   */
  function danhDauDaDoc(banId) {
    supabase.rpc('danh_dau_da_doc', { nguoi_gui: banId })
      .then(({ error }) => { if (error) console.error('Không đánh dấu đã đọc:', error.message); });
  }

  function xoaChuaDoc(banId) {
    const r = dsHoiThoai.find((x) => x.id === banId);
    if (r && Number(r.chua_doc) > 0) { r.chua_doc = 0; capNhatChuongBao(); }
  }

  // Mọi chỗ làm dsHoiThoai đổi đều chạy qua đây, nên đây là chỗ duy nhất cần
  // báo ra ngoài. Trang chủ nghe sự kiện này để vẽ lại mục Tin nhắn của nó —
  // khỏi phải tự hỏi máy chủ hay tự nối realtime lần hai.
  function capNhatChuongBao() {
    const n = dsHoiThoai.reduce((s, r) => s + Number(r.chua_doc || 0), 0);
    dot.hidden = n === 0;
    dot.textContent = n > 99 ? '99+' : String(n);
    datTieuDe(n);
    window.dispatchEvent(new CustomEvent('ashfall:hoi-thoai', { detail: { ds: dsHoiThoai } }));
  }

  // --------------------------------------------------- thẻ nổi trong trang ---
  function hienThe(ban, noiDung) {
    const t = el('div', 'ash-toast');
    t.setAttribute('role', 'status');

    const ava = el('div', 'ash-chat__ava');
    if (ban.avatar_url) ava.style.backgroundImage = `url("${ban.avatar_url.replace(/"/g, '%22')}")`;
    else ava.textContent = chuCai(ban);

    const meta = el('div', 'ash-chat__meta');
    meta.append(el('div', 'ash-chat__name', tenHienThi(ban)));
    meta.append(el('div', 'ash-chat__last', noiDung));

    const x = el('button', 'ash-toast__x', '✕');
    x.type = 'button';
    x.title = 'Bỏ qua';

    const di = () => {
      t.classList.add('ash-toast--di');
      setTimeout(() => t.remove(), 220);
    };
    x.onclick = (e) => { e.stopPropagation(); di(); };
    t.onclick = () => { di(); mo().then(() => moCuocTroChuyen(ban)); };

    t.append(ava, meta, x);
    khayToast.append(t);
    while (khayToast.children.length > 3) khayToast.firstElementChild.remove();
    setTimeout(di, 7000);
  }

  /** Gọi khi có tin mới gửi ĐẾN mình mà mình chưa đang đọc cuộc đó. */
  function baoTinMoi(ban, noiDung) {
    hienThe(ban, noiDung);
    keu();
    thongBaoHeThong(ban, noiDung, () => mo().then(() => moCuocTroChuyen(ban)));
  }

  /** Khung xương lúc chờ dữ liệu, để panel không mở ra trống trơn. */
  function veXuong(n = 4) {
    veHeader('Tin nhắn', false);
    body.replaceChildren(...Array.from({ length: n }, () => {
      const x = el('div', 'ash-chat__xuong');
      const a = el('i', 'a');
      const b = el('div', 'b');
      b.append(el('i'), el('i'));
      x.append(a, b);
      return x;
    }));
  }

  /** Nguồn sự thật duy nhất cho thanh tiêu đề. */
  function veHeader(tieuDe, coBack) {
    title.textContent = tieuDe;
    back.hidden = !coBack;
  }

  function veDanhSach() {
    veHeader('Tin nhắn', false);
    body.replaceChildren();

    if (!dsHoiThoai.length) {
      body.append(el('div', 'ash-chat__empty',
        'Chưa có bạn nào để nhắn tin.\nVào trang Bạn bè để kết bạn trước.'));
      return;
    }

    for (const r of dsHoiThoai) {
      const row = el('button', 'ash-chat__row');
      row.type = 'button';
      const chuaDoc = Number(r.chua_doc || 0);
      if (chuaDoc > 0) row.dataset.unread = '1';

      const ava = el('div', 'ash-chat__ava');
      if (r.avatar_url) ava.style.backgroundImage = `url("${r.avatar_url.replace(/"/g, '%22')}")`;
      else ava.textContent = chuCai(r);

      const meta = el('div', 'ash-chat__meta');
      const top = el('div', 'ash-chat__top');
      top.append(el('div', 'ash-chat__name', tenHienThi(r)));
      if (r.thoi_gian) top.append(el('span', 'ash-chat__khi', khiNao(r.thoi_gian)));
      meta.append(top);

      const xem = r.thoi_gian && r.tin_cuoi === null
        ? 'Tin nhắn đã thu hồi'
        : (r.tin_cuoi ? (r.tin_cuoi_cua_toi ? 'Bạn: ' : '') + r.tin_cuoi : 'Chưa có tin nhắn');
      meta.append(el('div', 'ash-chat__last', xem));

      row.append(ava, meta);
      if (chuaDoc > 0) row.append(el('span', 'ash-chat__n', chuaDoc > 9 ? '9+' : String(chuaDoc)));
      row.onclick = () => moCuocTroChuyen(r);
      body.append(row);
    }
  }

  // ------------------------------------------------- một cuộc trò chuyện ---
  async function moCuocTroChuyen(ban) {
    dangMo = ban;
    const cua = ++phien;                        // dấu mốc của lần mở này
    veHeader(tenHienThi(ban), true);
    body.replaceChildren(el('div', 'ash-chat__empty', 'Đang tải…'));

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at, deleted_at')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${ban.id}),and(sender_id.eq.${ban.id},recipient_id.eq.${me.id})`)
      .order('created_at', { ascending: false })   // mới nhất trước…
      .limit(50);                                  // …rồi lật lại khi vẽ

    if (cua !== phien) return;                  // người dùng đã bấm đi chỗ khác
    if (error) {
      const hop = el('div', 'ash-chat__empty');
      hop.append('Không tải được tin nhắn.' + String.fromCharCode(10) + dichLoi(error.message));
      const lai = el('button', 'ash-chat__thulai', 'Thử lại');
      lai.type = 'button';
      lai.onclick = () => moCuocTroChuyen(ban);
      hop.append(lai);
      body.replaceChildren(hop);
      return;
    }

    const list = el('div', 'ash-chat__msgs');
    const form = taoForm(ban);
    body.replaceChildren(list);
    panel.append(form);

    const manh = document.createDocumentFragment();     // dựng ngoài DOM rồi gắn một lần
    for (const m of data.slice().reverse()) manh.append(veTin(m, ban));
    list.append(manh);
    if (!data.length) list.append(el('div', 'ash-chat__empty', 'Chưa có tin nhắn nào.\nNói câu đầu tiên đi.'));

    body.scrollTop = body.scrollHeight;
    form.querySelector('textarea')?.focus();

    // đánh dấu đã đọc: cập nhật ngay ở máy, gửi lên máy chủ trong nền.
    // Luôn gọi, không dựa vào chua_doc — ban có thể đến từ danh sách bạn bè
    // hoặc sự kiện ashfall:mo-chat, những chỗ không mang theo số đếm.
    xoaChuaDoc(ban.id);
    danhDauDaDoc(ban.id);
  }

  function veTin(m, ban) {
    const cuaToi = m.sender_id === me.id;
    const b = el('div', `ash-chat__b ash-chat__b--${cuaToi ? 'me' : 'them'}`);
    b.dataset.id = m.id;

    if (m.deleted_at) {
      b.classList.add('ash-chat__b--go');
      b.textContent = 'Tin nhắn đã thu hồi';
    } else {
      b.textContent = m.body;
      const tools = el('div', 'ash-chat__tools');
      if (cuaToi) {
        const thuHoi = el('button', 'ash-chat__tool', 'Thu hồi');
        thuHoi.type = 'button';
        thuHoi.onclick = async () => {
          const { error } = await supabase.from('messages')
            .update({ deleted_at: new Date().toISOString() }).eq('id', m.id);
          if (error) return loi(dichLoi(error.message));
          b.classList.add('ash-chat__b--go');
          b.textContent = 'Tin nhắn đã thu hồi';
        };
        tools.append(thuHoi);
      } else {
        const baoCao = el('button', 'ash-chat__tool', 'Báo cáo');
        baoCao.type = 'button';
        baoCao.onclick = () => guiBaoCao(m, ban);
        tools.append(baoCao);
      }
      b.append(tools);
    }

    b.append(el('span', 'ash-chat__time', gio(m.created_at)));
    return b;
  }

  async function guiBaoCao(m, ban) {
    const ly_do = prompt(
      'Báo cáo tin nhắn này vì lý do gì?\n\n' +
      '1 — Quấy rối\n2 — Spam\n3 — Lừa đảo\n4 — Nội dung xấu\n5 — Khác\n\n' +
      'Nhập số (1-5):');
    if (!ly_do) return;
    const map = { 1: 'quay_roi', 2: 'spam', 3: 'lua_dao', 4: 'noi_dung_xau', 5: 'khac' };
    const reason = map[ly_do.trim()];
    if (!reason) return loi('Số không hợp lệ, hãy nhập từ 1 đến 5.');

    const note = prompt('Mô tả thêm (không bắt buộc):') || null;
    const { error } = await supabase.from('reports').insert({
      reporter_id: me.id, reported_id: ban.id, message_id: m.id, reason, note,
    });
    if (error) return loi(dichLoi(error.message));
    loi('Đã gửi báo cáo. Quản trị viên sẽ xem xét.');
  }

  function taoForm(ban) {
    panel.querySelector('.ash-chat__form')?.remove();
    const form = el('form', 'ash-chat__form');
    const ta = el('textarea');
    ta.rows = 1;
    ta.maxLength = 2000;
    ta.placeholder = 'Nhắn gì đó…';
    ta.setAttribute('aria-label', 'Nội dung tin nhắn');
    const send = el('button', 'ash-chat__send', '➤');
    send.type = 'submit';

    ta.addEventListener('input', () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 90) + 'px';
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body_ = ta.value.trim();
      if (!body_) return;
      send.disabled = true;
      const { error } = await supabase.from('messages')
        .insert({ sender_id: me.id, recipient_id: ban.id, body: body_ });
      send.disabled = false;
      if (error) return loi(dichLoi(error.message));
      ta.value = '';
      ta.style.height = 'auto';
      ta.focus();
    });

    form.append(ta, send);
    return form;
  }

  // --------------------------------------------------------- cập nhật ---
  const ngheRealtime = () => supabase
    .channel('ash-messages')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        const m = payload.new;
        if (m.sender_id !== me.id && m.recipient_id !== me.id) return;

        const doiPhuong = m.sender_id === me.id ? m.recipient_id : m.sender_id;

        // đang mở đúng cuộc trò chuyện đó và tab đang hiện → chèn thẳng vào khung
        const dangDocCuocNay = dangMo && doiPhuong === dangMo.id && dangXem && !document.hidden;

        if (dangMo && doiPhuong === dangMo.id && dangXem) {
          const list = body.querySelector('.ash-chat__msgs');
          if (list) {
            list.querySelector('.ash-chat__empty')?.remove();
            const oDay = body.scrollHeight - body.scrollTop - body.clientHeight < 80;
            list.append(veTin(m, dangMo));
            if (oDay) body.scrollTop = body.scrollHeight;   // chỉ cuộn nếu đang ở cuối
          }
          if (m.recipient_id === me.id && !document.hidden) {
            danhDauDaDoc(dangMo.id);
          }
        }

        // cập nhật danh sách tại chỗ — không hỏi lại máy chủ
        vaDanhSach(m, m.sender_id === me.id);
        if (dangDocCuocNay) xoaChuaDoc(doiPhuong);

        // tin gửi ĐẾN mình, mà mình không đang đọc đúng cuộc đó → báo
        if (m.recipient_id === me.id && !dangDocCuocNay) {
          const ban = dsHoiThoai.find((r) => r.id === m.sender_id);
          if (ban) baoTinMoi(ban, m.body);
        }
      })
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      (payload) => {
        const m = payload.new;
        if (!m.deleted_at) return;
        const b = body.querySelector(`.ash-chat__b[data-id="${m.id}"]`);
        if (b && !b.classList.contains('ash-chat__b--go')) {
          b.classList.add('ash-chat__b--go');
          b.textContent = 'Tin nhắn đã thu hồi';
          b.append(el('span', 'ash-chat__time', gio(m.created_at)));
        }
      })
    .subscribe();

  // ------------------------------------------------------------ điều khiển ---
  const mo = async () => {
    dangXem = true;
    panel.hidden = false;
    // vẽ ngay những gì đã có; chưa có gì thì hiện khung xương
    if (!dangMo) { dsHoiThoai.length ? veDanhSach() : veXuong(); }
    const cua = phien;
    await taiDanhSach();
    if (cua === phien && dangXem && !dangMo) veDanhSach();
  };
  const dong = () => {
    dangXem = false;
    dangMo = null;
    phien++;                                   // bỏ mọi kết quả đang chờ
    panel.hidden = true;
    panel.querySelector('.ash-chat__form')?.remove();
    veHeader('Tin nhắn', false);               // lần mở sau không còn dính tiêu đề cũ
  };

  fab.onclick = () => (panel.hidden ? mo() : dong());
  close.onclick = dong;
  back.onclick = () => {
    dangMo = null;
    phien++;
    panel.querySelector('.ash-chat__form')?.remove();
    veDanhSach();
  };

  // Thêm lối thoát: phím Esc, và bấm ra ngoài panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) { e.stopPropagation(); dong(); }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !root.contains(e.target) && !e.target.closest('.ash-toast')) dong();
  });

  // Trang khác (app.js) xin mở thẳng một cuộc trò chuyện.
  window.addEventListener('ashfall:mo-chat', async (e) => {
    const banId = e.detail?.banId;
    if (!banId) return;
    dangXem = true;
    panel.hidden = false;
    await taiDanhSach();
    const ban = dsHoiThoai.find((r) => r.id === banId);
    if (ban) moCuocTroChuyen(ban);
    else veDanhSach();
  });

  // quay lại tab trong khi đang mở một cuộc trò chuyện → đánh dấu đã đọc
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !dangXem || !dangMo) return;
    xoaChuaDoc(dangMo.id);                                    // cập nhật ngay ở máy
    danhDauDaDoc(dangMo.id);                                   // gửi lên trong nền
  });

  // Mở websocket và hỏi danh sách ngay lúc tải trang làm máy yếu giật một nhịp.
  // Đợi trình duyệt vẽ xong đã — chậm nửa giây không ai thấy.
  const ranh = (fn) => ('requestIdleCallback' in window
    ? requestIdleCallback(fn, { timeout: 2500 })
    : setTimeout(fn, 500));
  ranh(() => { ngheRealtime(); taiDanhSach(); });
  setInterval(() => { if (!document.hidden) taiDanhSach(); }, 180000); // dự phòng nếu realtime rớt
}

init().catch((e) => console.error('Chat lỗi:', e));
