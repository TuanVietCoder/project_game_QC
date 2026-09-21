// =============================================================================
// Ashfall — hộp chat nổi (kiểu Facebook)
// Tự gắn vào mọi trang có nạp file này. Chỉ hiện khi đã đăng nhập.
// Dùng: <script type="module" src="assets/js/chat.js"></script>
// =============================================================================
import { supabase, getProfile, dichLoi } from './auth.js';

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
  position:absolute; right:0; bottom:70px; width:340px; height:460px;
  display:flex; flex-direction:column; overflow:hidden;
  background:var(--bg-plate,#1a1510); border:1px solid var(--line-strong,#3a332c);
  border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.6);
}
.ash-chat__head{
  display:flex; align-items:center; gap:10px; padding:13px 14px;
  border-bottom:1px solid var(--line,#2a241f); flex:none;
}
.ash-chat__head b{ flex:1; font-size:14px; color:var(--ink,#efe6d4); font-weight:600;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ash-chat__icon{
  background:none; border:none; cursor:pointer; color:var(--muted,#a99a82);
  font-size:17px; line-height:1; padding:4px 6px; border-radius:6px;
}
.ash-chat__icon:hover{ color:var(--ink,#efe6d4); background:rgba(255,255,255,.06); }
.ash-chat__body{ flex:1; overflow-y:auto; padding:8px; }

.ash-chat__row{
  display:flex; align-items:center; gap:11px; width:100%; text-align:left;
  background:none; border:none; cursor:pointer; padding:10px; border-radius:9px; color:inherit;
}
.ash-chat__row:hover{ background:rgba(255,255,255,.05); }
.ash-chat__ava{
  width:38px; height:38px; flex:none; border-radius:50%;
  border:1.5px solid var(--ember-dim,#c97a38);
  background:var(--bg-plate-2,#221b14) center/cover no-repeat;
  display:grid; place-items:center;
  font:700 14px var(--font-display,serif); color:var(--ember,#ff9d47);
}
.ash-chat__meta{ flex:1; min-width:0; }
.ash-chat__name{ font-size:13.5px; color:var(--ink,#efe6d4); font-weight:600;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ash-chat__last{ font-size:12px; color:var(--muted-2,#75695a);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ash-chat__row[data-unread="1"] .ash-chat__last{ color:var(--ink,#efe6d4); font-weight:600; }
.ash-chat__n{
  flex:none; min-width:19px; height:19px; padding:0 5px; border-radius:999px;
  background:var(--crack,#cf4b3e); color:#fff; font:700 10px/19px var(--font-mono,monospace);
  text-align:center;
}

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

.ash-chat__empty{ padding:34px 20px; text-align:center; color:var(--muted-2,#75695a); font-size:12.5px; line-height:1.7; }
.ash-chat__err{
  margin:8px; padding:9px 11px; border-radius:8px; font-size:12px;
  background:rgba(207,75,62,.14); border:1px solid var(--crack,#cf4b3e); color:#f0b3ac;
}
.ash-chat[hidden]{ display:none; }

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

@media (max-width:480px){
  .ash-chat__panel{ width:calc(100vw - 24px); height:min(72vh,470px); right:-6px; }
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
    const n = new Notification(`${ban.username}#${ban.tag}`, {
      body: noiDung,
      icon: new URL('../tuanviet-studio-logo.jpg', import.meta.url).href,
      tag: 'ashfall-' + ban.id,                          // tin sau đè tin trước của cùng người
    });
    n.onclick = () => { window.focus(); n.close(); khiBam(); };
  } catch { /* không sao */ }
}

async function init() {
  const me = await getProfile();
  if (!me) return;                                  // chưa đăng nhập → không hiện gì

  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));

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

  const loi = (text) => {
    const e = el('div', 'ash-chat__err', text);
    body.prepend(e);
    setTimeout(() => e.remove(), 6000);
  };

  // --------------------------------------------------- danh sách bạn ---
  async function taiDanhSach() {
    const { data, error } = await supabase.rpc('danh_sach_hoi_thoai');
    if (error) { loi(dichLoi(error.message)); return; }
    dsHoiThoai = data || [];
    capNhatChuongBao();
    if (dangXem && !dangMo) veDanhSach();
  }

  function capNhatChuongBao() {
    const n = dsHoiThoai.reduce((s, r) => s + Number(r.chua_doc || 0), 0);
    dot.hidden = n === 0;
    dot.textContent = n > 99 ? '99+' : String(n);
    datTieuDe(n);
  }

  // --------------------------------------------------- thẻ nổi trong trang ---
  function hienThe(ban, noiDung) {
    const t = el('div', 'ash-toast');
    t.setAttribute('role', 'status');

    const ava = el('div', 'ash-chat__ava');
    if (ban.avatar_url) ava.style.backgroundImage = `url("${ban.avatar_url.replace(/"/g, '%22')}")`;
    else ava.textContent = chuCai(ban);

    const meta = el('div', 'ash-chat__meta');
    meta.append(el('div', 'ash-chat__name', `${ban.username}#${ban.tag}`));
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

  function veDanhSach() {
    title.textContent = 'Tin nhắn';
    back.hidden = true;
    body.replaceChildren();

    if (!dsHoiThoai.length) {
      body.append(el('div', 'ash-chat__empty',
        'Chưa có bạn nào để nhắn tin. Vào trang Bạn bè để kết bạn trước.'));
      return;
    }

    for (const r of dsHoiThoai) {
      const row = el('button', 'ash-chat__row');
      row.type = 'button';
      if (Number(r.chua_doc) > 0) row.dataset.unread = '1';

      const ava = el('div', 'ash-chat__ava');
      if (r.avatar_url) ava.style.backgroundImage = `url("${r.avatar_url.replace(/"/g, '%22')}")`;
      else ava.textContent = chuCai(r);

      const meta = el('div', 'ash-chat__meta');
      meta.append(el('div', 'ash-chat__name', `${r.username}#${r.tag}`));
      const xem = r.tin_cuoi === null && r.thoi_gian
        ? 'Tin nhắn đã thu hồi'
        : (r.tin_cuoi ? (r.tin_cuoi_cua_toi ? 'Bạn: ' : '') + r.tin_cuoi : 'Chưa có tin nhắn');
      meta.append(el('div', 'ash-chat__last', xem));

      row.append(ava, meta);
      if (Number(r.chua_doc) > 0) row.append(el('span', 'ash-chat__n', String(r.chua_doc)));
      row.onclick = () => moCuocTroChuyen(r);
      body.append(row);
    }
  }

  // ------------------------------------------------- một cuộc trò chuyện ---
  async function moCuocTroChuyen(ban) {
    dangMo = ban;
    title.textContent = `${ban.username}#${ban.tag}`;
    back.hidden = false;
    body.replaceChildren(el('div', 'ash-chat__empty', 'Đang tải…'));

    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at, deleted_at')
      .or(`and(sender_id.eq.${me.id},recipient_id.eq.${ban.id}),and(sender_id.eq.${ban.id},recipient_id.eq.${me.id})`)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) { body.replaceChildren(); loi(dichLoi(error.message)); return; }

    const list = el('div', 'ash-chat__msgs');
    const form = taoForm(ban);
    body.replaceChildren(list);
    panel.append(form);

    for (const m of data) list.append(veTin(m, ban));
    if (!data.length) list.append(el('div', 'ash-chat__empty', 'Chưa có tin nhắn nào. Nói câu đầu tiên đi.'));

    body.scrollTop = body.scrollHeight;
    await supabase.rpc('danh_dau_da_doc', { nguoi_gui: ban.id });
    await taiDanhSach();
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
  supabase
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
            list.append(veTin(m, dangMo));
            body.scrollTop = body.scrollHeight;
          }
          if (m.recipient_id === me.id && !document.hidden) {
            await supabase.rpc('danh_dau_da_doc', { nguoi_gui: dangMo.id });
          }
        }

        // tin gửi ĐẾN mình, mà mình không đang đọc đúng cuộc đó → báo
        if (m.recipient_id === me.id && !dangDocCuocNay) {
          const ban = dsHoiThoai.find((r) => r.id === m.sender_id);
          if (ban) baoTinMoi(ban, m.body);
        }

        await taiDanhSach();
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
    fab.textContent = '💬';
    fab.append(dot);
    await taiDanhSach();
    if (!dangMo) veDanhSach();
  };
  const dong = () => {
    dangXem = false;
    dangMo = null;
    panel.hidden = true;
    panel.querySelector('.ash-chat__form')?.remove();
  };

  fab.onclick = () => (panel.hidden ? mo() : dong());
  close.onclick = dong;
  back.onclick = () => {
    dangMo = null;
    panel.querySelector('.ash-chat__form')?.remove();
    veDanhSach();
  };

  // quay lại tab trong khi đang mở một cuộc trò chuyện → đánh dấu đã đọc
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || !dangXem || !dangMo) return;
    await supabase.rpc('danh_dau_da_doc', { nguoi_gui: dangMo.id });
    await taiDanhSach();
  });

  await taiDanhSach();
  setInterval(taiDanhSach, 60000);      // dự phòng nếu kết nối tức thời rớt
}

init().catch((e) => console.error('Chat lỗi:', e));
