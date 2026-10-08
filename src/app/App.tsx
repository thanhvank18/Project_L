import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { ArrowDown, ArrowUpRight, Asterisk, Check, List, X } from '@phosphor-icons/react'

const themes = [
  { name: 'Xanh', color: '#2249e8', background: '#e8edff' },
  { name: 'Cam', color: '#bd431b', background: '#fff0e8' },
  { name: 'Lục', color: '#21674d', background: '#e5f3eb' },
]

export function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [themeIndex, setThemeIndex] = useState(0)
  const [sent, setSent] = useState(false)
  const theme = themes[themeIndex] ?? themes[0]!

  function submitDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSent(true)
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Đến nội dung chính
      </a>
      <header id="top" className="site-header container">
        <a className="brand" href="#top" aria-label="Project L, đầu trang">
          <span className="brand-mark" aria-hidden="true">
            L.
          </span>
          <span>
            project l<span className="brand-caption">digital studio · demo</span>
          </span>
        </a>
        <button
          className="menu-toggle"
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="navigation"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={24} /> : <List size={24} />}
        </button>
        <nav
          id="navigation"
          className={menuOpen ? 'navigation is-open' : 'navigation'}
          aria-label="Điều hướng chính"
        >
          <a href="#approach" onClick={() => setMenuOpen(false)}>
            Cách làm
          </a>
          <a href="#preview" onClick={() => setMenuOpen(false)}>
            Khám phá
          </a>
          <a className="nav-contact" href="#contact" onClick={() => setMenuOpen(false)}>
            Cùng bắt đầu <ArrowUpRight size={18} />
          </a>
        </nav>
      </header>

      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-heading">
            <h1 id="hero-title">
              Ý tưởng tốt.
              <br />
              <span>Website xứng tầm.</span>
            </h1>
            <Asterisk className="hero-symbol" size={138} weight="bold" aria-hidden="true" />
          </div>
          <div className="hero-bottom">
            <p>
              Một nơi để ý tưởng của bạn thành hình. Từ câu chuyện thương hiệu đến trải nghiệm số rõ
              ràng, có cá tính.
            </p>
            <a className="button button-primary" href="#contact">
              Bắt đầu câu chuyện <ArrowUpRight size={22} />
            </a>
            <a className="scroll-link" href="#preview">
              Xem bản mẫu <ArrowDown size={18} />
            </a>
          </div>
        </section>

        <section className="showcase container" id="preview" aria-labelledby="preview-title">
          <div className="showcase-top">
            <h2 id="preview-title">Một ý tưởng. Nhiều sắc thái.</h2>
            <span>Bản mẫu tương tác</span>
          </div>
          <div
            className="preview-stage"
            style={
              {
                '--preview-color': theme.color,
                '--preview-background': theme.background,
              } as CSSProperties
            }
          >
            <div className="preview-note">
              <span>
                Không cần giống
                <br />
                bất kỳ ai.
              </span>
              <p>
                Chọn một màu.
                <br />
                Xem ý tưởng đổi sắc.
              </p>
            </div>
            <div className="browser-frame" aria-label={`Giao diện minh họa, màu ${theme.name}`}>
              <div className="browser-toolbar">
                <span className="browser-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>your-next-idea.studio</span>
                <ArrowUpRight size={14} />
              </div>
              <div className="mini-site" lang="en">
                <div className="mini-nav">
                  <strong>form & feeling</strong>
                  <span>Independent by nature.</span>
                </div>
                <div className="mini-content">
                  <div>
                    <h3>
                      Less noise.
                      <br />
                      More you.
                    </h3>
                    <p>A little clarity. A lot of character.</p>
                    <span className="mini-cta">
                      Make room for something new <ArrowUpRight size={16} />
                    </span>
                  </div>
                  <div className="sculpture" aria-hidden="true">
                    <div className="sculpture-top" />
                    <div className="sculpture-bottom" />
                    <span className="sculpture-shadow" />
                  </div>
                </div>
                <div className="mini-footer">
                  <span>Made with intention.</span>
                  <span>Something worth exploring.</span>
                </div>
              </div>
            </div>
            <div className="theme-picker" role="group" aria-label="Chọn màu bản mẫu">
              {themes.map((item, index) => (
                <button
                  key={item.name}
                  aria-label={`Màu ${item.name}`}
                  aria-pressed={themeIndex === index}
                  onClick={() => setThemeIndex(index)}
                  style={{ background: item.color }}
                >
                  {themeIndex === index && <Check size={16} weight="bold" />}
                </button>
              ))}
            </div>
          </div>
          <div className="showcase-caption">
            <span>Concept minh họa · Không phải dự án khách hàng</span>
            <span>Thiết kế rõ ràng, cảm giác khác biệt.</span>
          </div>
        </section>

        <section className="approach container" id="approach" aria-labelledby="approach-title">
          <div className="approach-intro">
            <h2 id="approach-title">
              Đẹp là khởi đầu.
              <br />
              Dễ dùng mới là đích đến.
            </h2>
            <p>Bản demo này thử một cách tiếp cận đơn giản: bỏ điều thừa, giữ điều có ý nghĩa.</p>
          </div>
          <div className="approach-list">
            <article>
              <h3>Câu chuyện trước, giao diện sau.</h3>
              <p>Hiểu điều bạn muốn nói để mỗi dòng chữ, mỗi khoảng trống đều có lý do tồn tại.</p>
            </article>
            <article>
              <h3>Cá tính trong từng chi tiết.</h3>
              <p>
                Màu sắc có chủ đích, nhịp điệu rõ ràng và một trải nghiệm nhất quán từ đầu đến cuối.
              </p>
            </article>
            <article>
              <h3>Gọn gàng trên mọi màn hình.</h3>
              <p>
                Một bố cục linh hoạt, dễ đọc và dễ tương tác, dù bạn đang dùng máy tính hay điện
                thoại.
              </p>
            </article>
          </div>
        </section>

        <section className="contact-section" id="contact" aria-labelledby="contact-title">
          <div className="contact-layout container">
            <div>
              <h2 id="contact-title">
                Ý tưởng tiếp theo
                <br />
                là của bạn.
              </h2>
              <p>Kể một chút về điều bạn muốn tạo ra.</p>
              <span className="demo-note">Form minh họa. Không gửi hay lưu thông tin.</span>
            </div>
            <form onSubmit={submitDemo} className="contact-form">
              <label htmlFor="name">Tên của bạn</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Bạn muốn chúng tôi gọi thế nào?"
                required
                maxLength={100}
                onChange={() => setSent(false)}
              />
              <label htmlFor="idea">Bạn đang nghĩ đến điều gì?</label>
              <textarea
                id="idea"
                name="idea"
                placeholder="Một website, một thương hiệu, một ý tưởng mới…"
                required
                maxLength={2000}
                rows={3}
                onChange={() => setSent(false)}
              />
              <button className="button button-light" type="submit">
                Thử gửi ý tưởng <ArrowUpRight size={20} />
              </button>
              <p className="form-status" role="status">
                {sent ? 'Đã thử thành công. Đây là bản demo, thông tin chưa được gửi đi.' : ''}
              </p>
            </form>
          </div>
        </section>
      </main>
      <footer className="site-footer container">
        <a className="footer-brand" href="#top">
          project l.
        </a>
        <span>Một khởi đầu, nhiều khả năng.</span>
        <a href="#main">
          Về đầu trang <ArrowUpRight size={16} />
        </a>
      </footer>
    </>
  )
}
