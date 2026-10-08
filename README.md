# Project_L

Dự án frontend cho một website. Nền tảng: React + Vite + TypeScript strict,
Tailwind CSS, pnpm, ESLint và Prettier. Mục đích website chưa chốt.

## Các file nền tảng

- `PRODUCT.md`: thông tin sản phẩm đã xác nhận và các quyết định còn mở.
- `AGENTS.md`: hướng dẫn Codex triển khai, thiết kế và kiểm tra trong dự án này.
- `.editorconfig`: chuẩn UTF-8, LF, thụt lề 2 dấu cách.
- `.gitignore`: bỏ qua dependencies, build output, cache và biến môi trường riêng.

## Quy trình thiết kế

1. Chốt mục đích website, người dùng, nội dung và trang cần làm.
2. Xác nhận yêu cầu SEO/rendering, API và hosting trước khi triển khai sản phẩm.
3. Dùng `design-taste-frontend` để định hướng landing page/portfolio/redesign phù hợp.
4. Dùng `impeccable` để kiểm tra và hoàn thiện giao diện.
5. Kiểm tra desktop/mobile, bàn phím, trạng thái lỗi và các tương tác chính.

Chưa chọn comp-first/code-first và chưa lưu mặc định cho Impeccable.
Chưa có `DESIGN.md` vì chưa chốt định hướng thị giác.

## Chạy dự án

Yêu cầu: Node.js 22.12+ và pnpm 11.25.0. Máy hiện tại có Node và pnpm
trong runtime của Codex. Nếu pnpm chưa có trong PATH, dùng script PowerShell:

```powershell
./scripts/pnpm.ps1 install --frozen-lockfile
./scripts/pnpm.ps1 dev
./scripts/pnpm.ps1 check
```

Khi pnpm đã có trong PATH:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
```

Development: http://127.0.0.1:5173. Production preview: `pnpm preview`
tại http://127.0.0.1:4173 sau `pnpm build`.

`pnpm check` chạy typecheck, lint, kiểm tra format và production build.
`pnpm format` tự format mã nguồn. ESLint kiểm tra React Hooks và accessibility.
VS Code có cấu hình format-on-save và danh sách extension đề xuất; extension
không được tự cài.

ESLint hiện khóa ở 9.39.5 để tương thích peer dependency chính thức của
`eslint-plugin-jsx-a11y` 6.10.2. Registry đã đánh dấu ESLint 9 hết hỗ trợ;
nâng đồng bộ ESLint và plugin accessibility khi plugin hỗ trợ ESLint 10.
TypeScript 5.9.3 được khóa cùng bộ typescript-eslint hiện tại.

## Cấu trúc

```text
src/
  app/App.tsx          # Entry giao diện
  main.tsx            # Bootstrap React
  styles/index.css    # Tailwind và CSS nền
scripts/pnpm.ps1       # Chạy pnpm trên máy hiện tại
```

Tạo `components`, `pages`, `features`, `services` khi có nhu cầu thực tế.
Import trong src có thể dùng alias `@/`. Chưa cài router, state manager hoặc
thư viện component vì chưa có yêu cầu chức năng.

Trang hiện tại là landing page demo cho một digital studio giả định, theo yêu cầu
thử giao diện. Nó có menu mobile, liên kết cuộn đến từng phần, bản xem thử đổi ba
màu và form mô phỏng có validation. Form không gửi dữ liệu, không lưu nội dung;
thông báo thành công chỉ xác nhận tương tác ở trình duyệt.

Font Be Vietnam Pro được self-host qua `@fontsource/be-vietnam-pro`; icon dùng
Phosphor. Mục đích sản phẩm thật vẫn chưa chốt. Thiết kế demo không phải thương
hiệu đã được duyệt. Chưa cấu hình hook tự động hoặc mặc định comp-first/code-first.
Các skill toàn cục được gọi theo AGENTS.md.

## Môi trường và xuất bản

Chỉ dùng biến `VITE_*` cho thông tin công khai; chúng có thể xuất hiện trong
bundle trình duyệt. Không đặt secret hoặc API key riêng trong frontend.
Thêm `.env.example` với dữ liệu an toàn khi có biến môi trường thực tế.

Trang khởi tạo có `noindex, nofollow`; thay đổi metadata theo nội dung thật
trước khi xuất bản. Backend, API, hosting, CI và yêu cầu SEO còn mở.

## Tài liệu nền tảng

- [Vite](https://vite.dev/guide/)
- [Tailwind với Vite](https://tailwindcss.com/docs/installation/using-vite)
- [ESLint configuration](https://eslint.org/docs/latest/use/configure/configuration-files)
