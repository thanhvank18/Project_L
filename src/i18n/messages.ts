export type Language = 'vi' | 'en'
export const languageStorageKey = 'project-l-language'

const vi = {
  skip: 'Đến nội dung chính',
  home: 'Project L, đầu trang',
  brandCaption: 'studio số · demo',
  openMenu: 'Mở menu',
  closeMenu: 'Đóng menu',
  navigation: 'Điều hướng chính',
  approach: 'Cách làm',
  explore: 'Khám phá',
  start: 'Cùng bắt đầu',
  heroFirst: 'Ý tưởng tốt.',
  heroSecond: 'Website xứng tầm.',
  heroBody:
    'Một nơi để ý tưởng của bạn thành hình. Từ câu chuyện thương hiệu đến trải nghiệm số rõ ràng, có cá tính.',
  heroCta: 'Bắt đầu câu chuyện',
  previewCta: 'Xem bản mẫu',
  previewTitle: 'Một ý tưởng. Nhiều sắc thái.',
  interactive: 'Bản mẫu tương tác',
  noteFirst: 'Không cần giống',
  noteSecond: 'bất kỳ ai.',
  chooseColor: 'Chọn một màu.',
  watchColor: 'Xem ý tưởng đổi sắc.',
  previewLabel: 'Giao diện minh họa, màu',
  colorGroup: 'Chọn màu bản mẫu',
  colorLabel: 'Màu',
  colors: ['Xanh', 'Cam', 'Lục'],
  miniTagline: 'Độc lập từ bản chất.',
  miniFirst: 'Bớt ồn ào.',
  miniSecond: 'Thêm cá tính.',
  miniBody: 'Một chút rõ ràng. Thật nhiều bản sắc.',
  miniCta: 'Dành chỗ cho điều mới mẻ',
  miniFooterFirst: 'Thiết kế có chủ đích.',
  miniFooterSecond: 'Một điều đáng khám phá.',
  concept: 'Concept minh họa · Không phải dự án khách hàng',
  caption: 'Thiết kế rõ ràng, cảm giác khác biệt.',
  approachFirst: 'Đẹp là khởi đầu.',
  approachSecond: 'Dễ dùng mới là đích đến.',
  approachBody: 'Bản demo này thử một cách tiếp cận đơn giản: bỏ điều thừa, giữ điều có ý nghĩa.',
  principles: [
    {
      title: 'Câu chuyện trước, giao diện sau.',
      body: 'Hiểu điều bạn muốn nói để mỗi dòng chữ, mỗi khoảng trống đều có lý do tồn tại.',
    },
    {
      title: 'Cá tính trong từng chi tiết.',
      body: 'Màu sắc có chủ đích, nhịp điệu rõ ràng và một trải nghiệm nhất quán từ đầu đến cuối.',
    },
    {
      title: 'Gọn gàng trên mọi màn hình.',
      body: 'Một bố cục linh hoạt, dễ đọc và dễ tương tác, dù bạn đang dùng máy tính hay điện thoại.',
    },
  ],
  contactFirst: 'Ý tưởng tiếp theo',
  contactSecond: 'là của bạn.',
  contactBody: 'Kể một chút về điều bạn muốn tạo ra.',
  disclaimer: 'Form minh họa. Không gửi hay lưu thông tin.',
  name: 'Tên của bạn',
  namePlaceholder: 'Bạn muốn chúng tôi gọi thế nào?',
  idea: 'Bạn đang nghĩ đến điều gì?',
  ideaPlaceholder: 'Một website, một thương hiệu, một ý tưởng mới…',
  submit: 'Thử gửi ý tưởng',
  success: 'Đã thử thành công. Đây là bản demo, thông tin chưa được gửi đi.',
  required: 'Vui lòng điền trường này.',
  footer: 'Một khởi đầu, nhiều khả năng.',
  backToTop: 'Về đầu trang',
  pageTitle: 'Project L · Studio số — Bản demo',
}

const en: typeof vi = {
  skip: 'Skip to main content',
  home: 'Project L, back to top',
  brandCaption: 'digital studio · demo',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  navigation: 'Main navigation',
  approach: 'Our approach',
  explore: 'Explore',
  start: 'Let’s begin',
  heroFirst: 'Good ideas.',
  heroSecond: 'Great websites.',
  heroBody:
    'A place for your ideas to take shape. From your brand story to a digital experience with clarity and character.',
  heroCta: 'Start a conversation',
  previewCta: 'See the concept',
  previewTitle: 'One idea. Many expressions.',
  interactive: 'Interactive concept',
  noteFirst: 'You don’t have to',
  noteSecond: 'look like anyone else.',
  chooseColor: 'Pick a color.',
  watchColor: 'See your idea change.',
  previewLabel: 'Illustrative interface, color',
  colorGroup: 'Choose a concept color',
  colorLabel: 'Color',
  colors: ['Blue', 'Orange', 'Green'],
  miniTagline: 'Independent by nature.',
  miniFirst: 'Less noise.',
  miniSecond: 'More you.',
  miniBody: 'A little clarity. A lot of character.',
  miniCta: 'Make room for something new',
  miniFooterFirst: 'Made with intention.',
  miniFooterSecond: 'Something worth exploring.',
  concept: 'Illustrative concept · Not a client project',
  caption: 'Clear design. A different feeling.',
  approachFirst: 'Looks are a start.',
  approachSecond: 'Ease of use is the goal.',
  approachBody:
    'This demo explores a simple approach: remove the unnecessary and keep what matters.',
  principles: [
    {
      title: 'Story first. Interface second.',
      body: 'Understand what you want to say so every word and every space has a reason to exist.',
    },
    {
      title: 'Character in every detail.',
      body: 'Intentional colors, a clear rhythm, and a consistent experience from beginning to end.',
    },
    {
      title: 'Considered for every screen.',
      body: 'A flexible layout that’s easy to read and interact with, on your computer or your phone.',
    },
  ],
  contactFirst: 'The next idea',
  contactSecond: 'is yours.',
  contactBody: 'Tell us a little about what you want to create.',
  disclaimer: 'Demo form. Information is not sent or stored.',
  name: 'Your name',
  namePlaceholder: 'What should we call you?',
  idea: 'What do you have in mind?',
  ideaPlaceholder: 'A website, a brand, a new idea…',
  submit: 'Try sending your idea',
  success: 'Demo successful. This is a demo; your information has not been sent.',
  required: 'Please fill out this field.',
  footer: 'One beginning. Many possibilities.',
  backToTop: 'Back to top',
  pageTitle: 'Project L · Digital studio — Demo',
}

export const messages = { vi, en }

export function getInitialLanguage(): Language {
  try {
    return localStorage.getItem(languageStorageKey) === 'en' ? 'en' : 'vi'
  } catch {
    return 'vi'
  }
}
