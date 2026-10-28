# Thêm đề thi JLPT

Trang `/library/exam` đọc danh sách đề từ `public/exams/index.json`. Mỗi đề là một mục trong `exams`:

```json
{
  "id": "n3-2023-12",
  "level": "N3",
  "title": "JLPT N3 · 12/2023",
  "pdf": "n3-2023-12/de.pdf",
  "audio": "n3-2023-12/nghe.mp3",
  "answerPdf": "n3-2023-12/dap-an.pdf",
  "scriptPdf": "n3-2023-12/script.pdf",
  "sections": [
    { "id": "vocab", "title": "Chữ Hán · Từ vựng", "minutes": 30,
      "groups": [{ "label": "問題1", "answers": [3, 3, 1] }] },
    { "id": "grammar", "title": "Ngữ pháp · Đọc hiểu", "minutes": 70, "groups": [] },
    { "id": "listening", "title": "Nghe hiểu", "minutes": 40, "audio": true, "groups": [] }
  ]
}
```

- Đề không có PDF: bỏ trường `pdf`, rồi thêm `questions` vào từng nhóm để hiện câu hỏi dạng chữ ngay trên màn hình thi (bấm chọn đáp án trực tiếp, không có phiếu riêng). `questions` phải khớp thứ tự và số lượng với `answers`:

```json
{ "label": "問題1", "instructions": "＿＿の言葉の読み方として最もよいものを選びなさい。", "passage": "(đoạn văn, tùy chọn)",
  "answers": [3],
  "questions": [{ "prompt": "弟がこれを割ってしまいました。", "options": ["けって", "おって", "わって", "さわって"] }] }
```

- File PDF/mp3 đặt trong `public/exams/<id>/`; đường dẫn trong JSON tính từ `public/exams/`.
- `answers` là đáp án đúng (1–4) theo thứ tự câu của từng 問題. Số câu = tổng độ dài các `answers`.
- `audio: true` ở một phần thì phần đó hiện trình phát mp3 của đề.
- `id` của đề và `id` của phần là khóa lưu kết quả, không nên đổi sau khi đã có người làm.
- Kết quả, thời gian và bài đang làm dở lưu ở khóa `nhat-jlpt-exam-v1` (localStorage, mất khi xóa dữ liệu trình duyệt).
- Mỗi đề nặng khoảng 30 MB (mp3 chiếm 20 MB); nhiều đề thì nên để file ở kho ngoài thay vì commit vào git.
