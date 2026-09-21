# 🎮 Ashfall - Soulslike Pixel Art Mobile Game Website

Official website for **Ashfall** (Tro Tàn) - a skill-based soulslike pixel art game for mobile platforms.

**Live:** https://ashfall.io.vn

> 🔑 **Có hệ thống tài khoản (đăng nhập, kết bạn, nhắn tin).**
> Trước khi sửa phần đó, đọc [`docs/HE-THONG-TAI-KHOAN.md`](docs/HE-THONG-TAI-KHOAN.md) —
> tài liệu ghi lại kiến trúc, các quyết định bảo mật và những bẫy đã dính.

## 📱 About Ashfall

Ashfall is a challenging soulslike game where **skill defeats all**. No grinding, no pay-to-win mechanics. Every boss fight is a fair test of your pattern recognition and reflexes.

- **Genre:** Soulslike / Pixel Art / Mobile
- **Platforms:** iOS, Android
- **Engine:** Godot 4.3
- **Status:** In Development (Demo available)
- **Developer:** TuanViet Studio

## 🌐 Website Features

- **Homepage** - Game showcase with hero section, weapons showcase, story, and world map preview
- **World Map** - Interactive boss locations and kingdom descriptions
- **News Hub** - Game updates, events, and guides
- **Blog** - In-depth articles on game design, soulslike mechanics, and strategy guides
- **Studio Page** - Developer info and contact
- **Responsive Design** - Optimized for desktop, tablet, and mobile

## 📂 Project Structure

```
project_game_QC/
├── index.html             # Trang chủ
├── map.html               # Bản đồ thế giới
├── studio.html            # Hồ sơ Lê Đoàn Tuấn Việt / TuanViet Studio
├── tin-tuc.html           # Trang tin tức
├── tin-tuc-N.html         # Bài tin tức (1-3)
├── blog.html              # Trang blog
├── blog-post-N.html       # Bài blog (1-6)
├── 404.html               # Trang báo lỗi 404 (noindex)
├── dang-nhap.html         # Đăng nhập / đăng ký
├── ho-so.html             # Hồ sơ người chơi
├── ban-be.html            # Tìm người, kết bạn
├── chinh-sach-bao-mat.html
├── supabase/              # Lược đồ database (KHÔNG xuất bản lên web)
├── assets/css/base.css    # Token màu + nav dùng chung
├── assets/js/auth.js      # Đăng nhập dùng chung
├── assets/js/chat.js      # Widget chat nổi
├── assets/                # Ảnh, logo, nhạc nền
│   ├── avatar.jpg         # Ảnh đại diện
│   ├── humocvuong.jpg     # Ảnh boss Hủ Mộc Vương
│   ├── tuanviet-studio-logo.jpg
│   └── bgm.mp3
├── docs/seo/              # Tài liệu SEO/outreach nội bộ (KHÔNG xuất bản lên web)
├── sitemap.xml            # Sơ đồ trang cho Google
├── robots.txt             # Chỉ dẫn cho bot
├── CNAME                  # Tên miền ashfall.io.vn
├── _config.yml            # Loại docs/README khỏi bản xuất bản
```

## 🎨 Design & Style

- **Color Scheme:** Dark theme with orange/red accents
- **Fonts:** Spectral (display), Be Vietnam Pro (body), System mono (UI)
- **Responsive Breakpoints:** 
  - Desktop: 1060px max-width
  - Tablet: 900px / 620px
  - Mobile: 100% width

## 📝 Content

### Pages
- **Homepage** - Hero section with game features, weapons, story, world overview
- **World Map** - Detailed boss locations and game progression
- **Studio** - Developer bio, projects, tech stack
- **News** - Game updates and community news
- **Blog** - 6 in-depth articles covering:
  - Game analysis
  - Boss guides
  - Game design theory
  - Comparisons with other soulslike games
  - Psychology of difficulty
  - Soulslike brand positioning

### SEO Features
- 55+ Vietnamese keywords optimized
- Meta tags for social sharing (OG, Twitter)
- JSON-LD structured data (Blog, Article, NewsArticle)
- Sitemap and robots.txt for search engines
- Internal linking strategy for SEO authority distribution

## 🎵 Interactive Features

- **Background Music Control** - Persistent audio across page navigation using sessionStorage
- **Language Toggle** - Vietnamese/English (VI/EN)
- **Responsive Grid Layouts** - Adaptive blog/news grids
- **Smooth Animations** - Hover effects, scroll reveals

## 🚀 Deployment

Hosted on **GitHub Pages** (build từ nhánh `main`, thư mục gốc).

**Branch:** `main` → Auto-deploys to https://ashfall.io.vn

To deploy:
```bash
git add .
git commit -m "Your message"
git push origin main
# Website updates automatically in 1-3 minutes
```

## 🛠 Tech Stack

- **HTML5** - Semantic structure
- **CSS3** - Responsive design, gradients, animations
- **JavaScript** - Vanilla JS for interactivity
  - Audio control with sessionStorage
  - Language toggle
  - Search/filter functionality
- **No Build Step** - Pure static site (fast, simple)

## 📊 Performance & SEO

- ✅ Lightweight (no frameworks, no build step)
- ✅ Fast page loads (pure HTML/CSS/JS)
- ✅ Mobile-first responsive design
- ✅ SEO-optimized with structured data
- ✅ Social sharing ready (meta tags)
- ✅ Accessible (semantic HTML, ARIA labels)

## 🤝 Contributing

This is a personal/studio project. For collaboration inquiries:
- Email: wannacry74123@gmail.com
- GitHub: [@TuanVietCoder](https://github.com/TuanVietCoder)

## 📄 License

[Specify your preferred license - MIT, GPL, etc.]

Game and website © 2026 TuanViet Studio. All rights reserved.

---

**Website Last Updated:** September 2026  
**Game Status:** In Development  
**Demo:** Available on iOS/Android (via TestFlight/Google Play Beta)

For more info about Ashfall, visit https://ashfall.io.vn