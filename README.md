# VIETNAM WARRIOR SHOP

Website cộng đồng phong cách đen – vàng, có tài khoản, cửa hàng, giỏ hàng, đơn hàng, ví xu demo và trang quản trị.

## 1. Yêu cầu
- Node.js 20 trở lên
- npm

## 2. Chạy thử trên máy
1. Giải nén thư mục.
2. Mở terminal tại thư mục dự án.
3. Chạy `npm install`.
4. Sao chép `.env.example` thành `.env`.
5. Sửa `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` trong `.env`.
6. Chạy `npm start`.
7. Mở `http://localhost:3000`.

Đăng nhập Admin bằng email/mật khẩu bạn đặt trong `.env`. Tài khoản Admin được tạo tự động lần đầu khởi động.

## 3. Đưa website lên mạng
Bạn có thể triển khai trên một dịch vụ Node.js hosting hỗ trợ ứng dụng Express và ổ đĩa lưu trữ bền vững:
- Build/install command: `npm install`
- Start command: `npm start`
- Thêm biến môi trường `NODE_ENV=production`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Gắn domain riêng trong phần quản lý domain của nhà cung cấp.
- Bật HTTPS.
- Bảo đảm thư mục `data/` được lưu bền vững và được sao lưu; SQLite không phù hợp nếu hosting dùng filesystem tạm thời hoặc nhiều instance đồng thời.

Không đưa file `.env` lên GitHub. Đổi mật khẩu Admin ngay khi cần và sao lưu database.

## 4. Thêm sản phẩm
Đăng nhập Admin → Tài khoản → Quản trị → Thêm sản phẩm.
- Tên, phân loại, mô tả, giá xu demo.
- Ảnh phải là URL HTTPS.
- `Mã tích hợp game` là nhãn nội bộ để bạn nhận biết sản phẩm. Nó chưa tự cấp Tool vào Roblox.

## 5. Phạm vi ví và thanh toán
Ví hiện tại chỉ là **xu demo nội bộ** để thử giao diện, giỏ hàng và luồng đơn hàng. Admin có thể cộng/trừ xu demo. Không có chuyển khoản thật, xử lý thẻ cào, nạp/rút tiền hay đổi tiền demo thành Robux/vật phẩm. Không dùng phiên bản demo này để nhận tiền thật.

Đối với bán nội dung Roblox, hãy dùng các cơ chế thanh toán và phân phối được Roblox cho phép. Việc tích hợp cấp vật phẩm trong game cần được xây riêng trong Roblox Studio, có xác thực phía server và kiểm tra quyền sở hữu phù hợp.

## 6. Lưu ý bảo mật trước khi vận hành
- Dùng mật khẩu Admin mạnh và giữ kín biến môi trường.
- Dùng HTTPS.
- Sao lưu `data/shop.sqlite` thường xuyên.
- Thêm email xác minh, chính sách quyền riêng tư, điều khoản sử dụng và quy trình hỗ trợ trước khi mở công khai.
- Dùng dịch vụ lưu session/database bền vững nếu nhà cung cấp hosting không hỗ trợ SQLite trên ổ đĩa bền vững.
