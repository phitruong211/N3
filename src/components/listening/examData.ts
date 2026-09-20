export type ExamLevel = 'N4' | 'N3' | 'N2';
export type ExamQuestion = { prompt: string; options: [string, string, string, string]; answer: number; explanation: string };
export type ExamItem = {
  id: string;
  level: ExamLevel;
  category: string;
  title: string;
  transcript: { ja: string; vi: string }[];
  questions: ExamQuestion[];
};

// Original practice material inspired by JLPT listening formats; no official exam items.
export const examItems: ExamItem[] = [
  {
    id: 'n4-station', level: 'N4', category: 'Thông báo', title: 'Đổi sân ga',
    transcript: [
      { ja: 'お知らせします。三時半の京都行きの電車は、二番線から出ます。', vi: 'Xin thông báo: tàu đi Kyoto lúc 3 giờ 30 sẽ khởi hành từ đường ray số 2.' },
      { ja: 'いつもの三番線ではありませんので、ご注意ください。', vi: 'Xin chú ý, hôm nay không phải đường ray số 3 như thường lệ.' },
      { ja: '電車はあと五分で来ます。', vi: 'Tàu sẽ đến sau năm phút nữa.' },
    ],
    questions: [
      { prompt: 'Tàu đi Kyoto khởi hành từ đường ray nào?', options: ['Số 1', 'Số 2', 'Số 3', 'Số 5'], answer: 1, explanation: '「二番線から出ます」: tàu khởi hành từ đường ray số 2.' },
      { prompt: 'Tàu sẽ đến sau bao lâu?', options: ['3 phút', '5 phút', '15 phút', '30 phút'], answer: 1, explanation: '「あと五分で来ます」 nghĩa là còn 5 phút nữa tàu đến.' },
    ],
  },
  {
    id: 'n4-lunch', level: 'N4', category: 'Hội thoại', title: 'Hẹn ăn trưa',
    transcript: [
      { ja: '田中さん、今日のお昼、一緒に食べませんか。', vi: 'Anh Tanaka, trưa nay ăn cùng tôi nhé?' },
      { ja: 'いいですね。でも、十二時まで会議があります。', vi: 'Được đấy. Nhưng tôi có cuộc họp đến 12 giờ.' },
      { ja: 'じゃ、十二時半に一階の入り口で会いましょう。', vi: 'Vậy 12 giờ 30 gặp nhau ở cửa ra vào tầng một nhé.' },
    ],
    questions: [
      { prompt: 'Hai người hẹn gặp lúc mấy giờ?', options: ['11:30', '12:00', '12:30', '13:00'], answer: 2, explanation: '「十二時半」 là 12 giờ 30.' },
      { prompt: 'Họ hẹn gặp ở đâu?', options: ['Phòng họp', 'Cửa ra vào tầng một', 'Nhà ăn tầng hai', 'Trước ga'], answer: 1, explanation: '「一階の入り口」 là cửa ra vào tầng một.' },
    ],
  },
  {
    id: 'n4-shopping', level: 'N4', category: 'Mua sắm', title: 'Mua áo',
    transcript: [
      { ja: 'この青いシャツはいくらですか。', vi: 'Chiếc áo sơ mi màu xanh này giá bao nhiêu?' },
      { ja: '二千円です。白いシャツは千五百円ですよ。', vi: 'Hai nghìn yên. Còn chiếc màu trắng là một nghìn năm trăm yên.' },
      { ja: 'じゃ、白いのを一枚ください。', vi: 'Vậy cho tôi một chiếc màu trắng.' },
    ],
    questions: [
      { prompt: 'Người mua chọn áo màu gì?', options: ['Xanh', 'Trắng', 'Đen', 'Đỏ'], answer: 1, explanation: '「白いのを一枚」: một chiếc màu trắng.' },
      { prompt: 'Chiếc áo đó giá bao nhiêu?', options: ['1.000 yên', '1.500 yên', '2.000 yên', '2.500 yên'], answer: 1, explanation: 'Áo trắng có giá 「千五百円」: 1.500 yên.' },
    ],
  },
  {
    id: 'n4-clinic', level: 'N4', category: 'Sinh hoạt', title: 'Đặt lịch khám',
    transcript: [
      { ja: '明日の午後、病院へ行きたいんですが、何時が空いていますか。', vi: 'Chiều mai tôi muốn đến bệnh viện, lúc mấy giờ còn lịch trống?' },
      { ja: '二時はいっぱいですが、三時なら大丈夫です。', vi: 'Hai giờ đã kín, nhưng ba giờ thì được.' },
      { ja: '分かりました。三時に行きます。', vi: 'Tôi hiểu rồi. Tôi sẽ đến lúc ba giờ.' },
    ],
    questions: [
      { prompt: 'Người gọi sẽ đến bệnh viện lúc nào?', options: ['Hôm nay lúc 2 giờ', 'Hôm nay lúc 3 giờ', 'Ngày mai lúc 2 giờ', 'Ngày mai lúc 3 giờ'], answer: 3, explanation: '「明日の午後」 và 「三時に行きます」: ngày mai lúc 3 giờ chiều.' },
      { prompt: 'Vì sao không chọn 2 giờ?', options: ['Bệnh viện đóng cửa', 'Lịch đã kín', 'Bác sĩ nghỉ', 'Người gọi bận'], answer: 1, explanation: '「二時はいっぱい」: lịch 2 giờ đã kín.' },
    ],
  },
  {
    id: 'n3-meeting', level: 'N3', category: 'Công việc', title: 'Đổi giờ họp',
    transcript: [
      { ja: '明日の会議ですが、部長の予定が変わったので、一時間早く始めることになりました。', vi: 'Cuộc họp ngày mai sẽ bắt đầu sớm hơn một tiếng vì lịch của trưởng phòng thay đổi.' },
      { ja: '資料は今日中にメールで送ってください。', vi: 'Hãy gửi tài liệu qua email trong hôm nay.' },
      { ja: '会議室は前と同じ、三階の部屋です。', vi: 'Phòng họp vẫn như trước, ở tầng ba.' },
    ],
    questions: [
      { prompt: 'Điều gì thay đổi ở cuộc họp?', options: ['Địa điểm', 'Ngày họp', 'Giờ bắt đầu', 'Người tham gia'], answer: 2, explanation: '「一時間早く始める」: bắt đầu sớm hơn một tiếng; phòng không đổi.' },
      { prompt: 'Tài liệu cần gửi khi nào?', options: ['Trong hôm nay', 'Sáng mai', 'Sau cuộc họp', 'Tuần sau'], answer: 0, explanation: '「今日中に」 có nghĩa là trong hôm nay.' },
    ],
  },
  {
    id: 'n3-trip', level: 'N3', category: 'Du lịch', title: 'Chuyến đi cuối tuần',
    transcript: [
      { ja: '土曜日に山へ行くつもりだったけど、雨が強く降るそうだよ。', vi: 'Tớ định đi núi thứ Bảy, nhưng nghe nói trời sẽ mưa to.' },
      { ja: 'それなら、日曜日に変更しない？予報では晴れるみたい。', vi: 'Vậy chuyển sang Chủ nhật nhé? Dự báo có vẻ trời sẽ nắng.' },
      { ja: 'いいね。朝八時に駅の前で待ち合わせよう。', vi: 'Được đấy. Hẹn gặp trước ga lúc 8 giờ sáng.' },
    ],
    questions: [
      { prompt: 'Cuối cùng hai người đi núi ngày nào?', options: ['Thứ Sáu', 'Thứ Bảy', 'Chủ nhật', 'Thứ Hai'], answer: 2, explanation: 'Họ chuyển từ thứ Bảy sang 「日曜日」 vì dự báo mưa.' },
      { prompt: 'Họ hẹn gặp ở đâu?', options: ['Trước ga', 'Trên núi', 'Trước nhà', 'Trong quán cà phê'], answer: 0, explanation: '「駅の前で待ち合わせよう」: gặp nhau trước ga.' },
    ],
  },
  {
    id: 'n3-library', level: 'N3', category: 'Thông báo', title: 'Thư viện đóng cửa',
    transcript: [
      { ja: '図書館からのお知らせです。来週の月曜日は工事のため、図書館を閉めます。', vi: 'Thông báo từ thư viện: thứ Hai tuần sau thư viện đóng cửa để sửa chữa.' },
      { ja: '返却日が月曜日の本は、火曜日までに返してください。', vi: 'Sách có hạn trả vào thứ Hai thì vui lòng trả trước hoặc trong thứ Ba.' },
      { ja: '火曜日はいつもどおり朝九時から開きます。', vi: 'Thứ Ba thư viện mở cửa như thường lệ từ 9 giờ sáng.' },
    ],
    questions: [
      { prompt: 'Vì sao thứ Hai thư viện đóng cửa?', options: ['Ngày lễ', 'Sửa chữa', 'Kiểm kê sách', 'Thiếu nhân viên'], answer: 1, explanation: '「工事のため」: do thi công, sửa chữa.' },
      { prompt: 'Sách đến hạn thứ Hai có thể trả chậm nhất khi nào?', options: ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư'], answer: 2, explanation: '「火曜日までに」 là hạn chót vào thứ Ba.' },
    ],
  },
  {
    id: 'n3-package', level: 'N3', category: 'Sinh hoạt', title: 'Nhận bưu kiện',
    transcript: [
      { ja: '昨日、荷物を届けに来ましたが、誰もいなかったので持ち帰りました。', vi: 'Hôm qua chúng tôi đến giao bưu kiện, nhưng không có ai ở nhà nên đã mang về.' },
      { ja: '今日の午後は家にいるので、もう一度届けてもらえますか。', vi: 'Chiều nay tôi ở nhà, anh có thể giao lại được không?' },
      { ja: 'はい。四時から六時の間にお届けします。', vi: 'Vâng. Chúng tôi sẽ giao trong khoảng từ 4 đến 6 giờ.' },
    ],
    questions: [
      { prompt: 'Vì sao hôm qua bưu kiện chưa được giao?', options: ['Sai địa chỉ', 'Không có ai ở nhà', 'Bưu kiện bị hỏng', 'Trời mưa'], answer: 1, explanation: '「誰もいなかったので持ち帰りました」: không ai ở nhà nên mang về.' },
      { prompt: 'Khi nào bưu kiện sẽ được giao lại?', options: ['Sáng nay', 'Từ 2 đến 4 giờ', 'Từ 4 đến 6 giờ', 'Tối mai'], answer: 2, explanation: '「四時から六時の間」: khoảng 4 đến 6 giờ chiều.' },
    ],
  },
  {
    id: 'n2-policy', level: 'N2', category: 'Công việc', title: 'Quy định làm việc mới',
    transcript: [
      { ja: '来月から、週に二日まで自宅で勤務できるようになります。', vi: 'Từ tháng sau, nhân viên có thể làm việc tại nhà tối đa hai ngày mỗi tuần.' },
      { ja: 'ただし、チーム全員が集まる水曜日は、原則として出社してください。', vi: 'Tuy nhiên, về nguyên tắc mọi người phải đến công ty vào thứ Tư, khi cả nhóm họp mặt.' },
      { ja: '希望する曜日は、前の週の金曜日までに上司に伝える必要があります。', vi: 'Cần báo cho cấp trên những ngày muốn làm ở nhà chậm nhất vào thứ Sáu tuần trước.' },
    ],
    questions: [
      { prompt: 'Theo thông báo, ngày nào về nguyên tắc phải đến công ty?', options: ['Thứ Hai', 'Thứ Tư', 'Thứ Sáu', 'Cả tuần'], answer: 1, explanation: '「水曜日は、原則として出社」: về nguyên tắc phải đi làm tại văn phòng thứ Tư.' },
      { prompt: 'Hạn báo ngày làm việc tại nhà là khi nào?', options: ['Thứ Sáu tuần trước', 'Thứ Hai cùng tuần', 'Sáng ngày hôm đó', 'Cuối tháng'], answer: 0, explanation: '「前の週の金曜日までに」: chậm nhất thứ Sáu tuần trước.' },
    ],
  },
  {
    id: 'n2-seminar', level: 'N2', category: 'Bài giảng', title: 'Thói quen học tập',
    transcript: [
      { ja: '新しい言葉を覚えるとき、一度に長時間勉強するより、短い時間でも毎日復習するほうが効果的だと言われています。', vi: 'Khi học từ mới, người ta cho rằng ôn tập mỗi ngày dù thời gian ngắn vẫn hiệu quả hơn học rất lâu trong một lần.' },
      { ja: '特に、覚えた翌日と一週間後に確認すると、忘れにくくなります。', vi: 'Đặc biệt, kiểm tra lại vào ngày hôm sau và một tuần sau khi học sẽ giúp khó quên hơn.' },
      { ja: '大切なのは、勉強時間の長さではなく、続けることです。', vi: 'Điều quan trọng là duy trì đều đặn, chứ không phải thời gian học dài bao nhiêu.' },
    ],
    questions: [
      { prompt: 'Ý chính của người nói là gì?', options: ['Nên học nhiều giờ một lần', 'Nên học đều và ôn thường xuyên', 'Chỉ học từ khó', 'Một tuần học một lần'], answer: 1, explanation: 'Người nói nhấn mạnh ôn mỗi ngày và tiếp tục học đều đặn.' },
      { prompt: 'Theo bài, nên kiểm tra lại từ mới vào lúc nào?', options: ['Ngay trước khi ngủ', 'Ngày hôm sau và một tuần sau', 'Sau một tháng', 'Chỉ khi quên'], answer: 1, explanation: '「覚えた翌日と一週間後」: ngày hôm sau và một tuần sau.' },
    ],
  },
  {
    id: 'n2-event', level: 'N2', category: 'Thông báo', title: 'Sự kiện ngoài trời',
    transcript: [
      { ja: '明日の野外コンサートは、雨が降っても予定どおり行います。', vi: 'Buổi hòa nhạc ngoài trời ngày mai vẫn diễn ra theo kế hoạch kể cả khi trời mưa.' },
      { ja: 'ただし、強風で安全が確保できない場合は、中止となる可能性があります。', vi: 'Tuy nhiên, nếu gió mạnh khiến không thể bảo đảm an toàn, chương trình có thể bị hủy.' },
      { ja: '最終的な判断は、当日の朝七時に公式サイトで発表します。', vi: 'Quyết định cuối cùng sẽ được thông báo trên trang web chính thức lúc 7 giờ sáng hôm diễn ra sự kiện.' },
    ],
    questions: [
      { prompt: 'Trường hợp nào buổi hòa nhạc có thể bị hủy?', options: ['Mưa nhẹ', 'Gió mạnh ảnh hưởng an toàn', 'Ít khán giả', 'Bắt đầu muộn'], answer: 1, explanation: '「強風で安全が確保できない場合」: gió mạnh làm mất an toàn.' },
      { prompt: 'Xem quyết định cuối cùng ở đâu và khi nào?', options: ['Email tối nay', 'Radio lúc 7 giờ tối', 'Trang web chính thức lúc 7 giờ sáng', 'Tại địa điểm lúc 9 giờ'], answer: 2, explanation: '「当日の朝七時に公式サイトで発表」: 7 giờ sáng hôm đó trên trang chính thức.' },
    ],
  },
  {
    id: 'n2-interview', level: 'N2', category: 'Phỏng vấn', title: 'Đi lại bằng xe đạp',
    transcript: [
      { ja: '自転車通勤を始めてから、電車の遅れを心配する必要がなくなりました。', vi: 'Từ khi bắt đầu đi làm bằng xe đạp, tôi không còn phải lo tàu bị trễ nữa.' },
      { ja: '最初は疲れましたが、今では体調もよくなったと感じています。', vi: 'Lúc đầu tôi thấy mệt, nhưng giờ cảm thấy sức khỏe cũng tốt hơn.' },
      { ja: 'もちろん、雨の日は無理をせず、電車を利用しています。', vi: 'Dĩ nhiên, vào ngày mưa tôi không cố đi xe đạp mà dùng tàu điện.' },
    ],
    questions: [
      { prompt: 'Người nói thấy lợi ích nào của việc đi xe đạp?', options: ['Không cần lo tàu trễ', 'Không bao giờ mệt', 'Có thêm ngày nghỉ', 'Được công ty trả tiền'], answer: 0, explanation: '「電車の遅れを心配する必要がなくなりました」: không cần lo tàu trễ.' },
      { prompt: 'Ngày mưa người nói làm gì?', options: ['Nghỉ làm', 'Đi bộ', 'Đi xe đạp như thường', 'Đi tàu điện'], answer: 3, explanation: '「雨の日は…電車を利用しています」: ngày mưa thì đi tàu điện.' },
    ],
  },
];
