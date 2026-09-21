// =============================================================================
// Ashfall — module tài khoản dùng chung
// Dùng: <script type="module" src="assets/js/auth.js"></script>
// Khóa dưới đây là khóa CÔNG KHAI (anon). Mọi lớp bảo vệ nằm ở Row Level
// Security trong supabase/schema.sql, không nằm ở file này.
// =============================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://bvpuxsywjnlisbrzhboz.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2cHV4c3l3am5saXNicnpoYm96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NjYyMjEsImV4cCI6MjEwNTU0MjIyMX0.84_KKXYZhAn_DSw3QneT4tbZc2MQ2q_EhpDw0LjKa5g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Hồ sơ của người đang đăng nhập, hoặc null. */
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, tag, display_name, avatar_url, bio, role, status, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) { console.error('Không đọc được hồ sơ:', error.message); return null; }
  return data ? { ...data, email: user.email } : null;
}

/** "TuanViet#0417" */
export const riotId = (p) => (p ? `${p.username}#${p.tag}` : '');

export async function signOut() {
  await supabase.auth.signOut();
  location.href = 'index.html';
}

// Thông báo lỗi của Supabase là tiếng Anh — dịch những lỗi hay gặp.
const LOI = {
  'Invalid login credentials': 'Email hoặc mật khẩu không đúng.',
  'Email not confirmed': 'Bạn chưa xác nhận email. Kiểm tra hộp thư (cả mục spam).',
  'User already registered': 'Email này đã được đăng ký. Hãy đăng nhập.',
  'Password should be at least 6 characters': 'Mật khẩu phải có ít nhất 6 ký tự.',
  'Unable to validate email address: invalid format': 'Địa chỉ email không hợp lệ.',
  'For security purposes, you can only request this after 60 seconds':
    'Vì lý do bảo mật, hãy đợi 60 giây rồi thử lại.',
};
export const dichLoi = (m) =>
  LOI[m] || Object.entries(LOI).find(([k]) => m?.includes(k))?.[1] || m || 'Có lỗi xảy ra, thử lại sau.';

/**
 * Gắn trạng thái đăng nhập vào nút .signin ở góc phải.
 * Chưa đăng nhập → "Đăng nhập". Đã đăng nhập → Riot ID, bấm vào ra hồ sơ.
 */
export async function mountAuthButton() {
  const btn = document.querySelector('.signin');
  if (!btn) return;

  const render = async () => {
    const p = await getProfile();
    if (p) {
      const a = document.createElement('a');
      a.className = btn.className;
      a.href = 'ho-so.html';
      a.textContent = riotId(p);
      a.style.textDecoration = 'none';
      a.setAttribute('aria-label', `Hồ sơ của ${riotId(p)}`);
      btn.replaceWith(a);
    } else {
      btn.addEventListener('click', () => { location.href = 'dang-nhap.html'; });
    }
  };

  await render();
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') location.reload();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountAuthButton, { once: true });
} else {
  mountAuthButton();
}
