import type { ReadingDefinition, ReadingQuestion, ReadingResponse, Text } from '../shared/portal.ts'

const t = (vi: string, en: string): Text => ({ vi, en })
const english = (text: string): Text => ({ vi: text, en: text })
const single = (id: string, prompt: string, labels: string[]): ReadingQuestion => ({
  id,
  kind: 'single',
  prompt: english(prompt),
  options: labels.map((label, index) => ({
    id: String.fromCharCode(97 + index),
    label: english(label),
  })),
})
const short = (id: string, prompt: string, maxWords: number): ReadingQuestion => ({
  id,
  kind: 'short',
  prompt: english(prompt),
  maxWords,
})
const questions = (items: ReadingQuestion[]): ReadingDefinition => ({
  startNumber: 1,
  groups: [
    {
      id: 'questions',
      title: t('Hiểu ý chính và chi tiết', 'Main ideas and details'),
      instructions: t(
        'Chọn một đáp án cho mỗi câu trắc nghiệm. Với câu trả lời ngắn, tuân thủ số từ tối đa ghi bên cạnh câu hỏi.',
        'Choose one answer for each multiple-choice question. For short answers, follow the word limit shown beside the question.',
      ),
      questions: items,
    },
  ],
})

interface StarterUnit {
  key: string
  title: Text
  objectives: Text
  vocabulary: Text
  passage: string
  reading: ReadingDefinition
  readingAnswers: ReadingResponse
  readingRationale: Text
  transcript: string
  listening: ReadingDefinition
  listeningAnswers: ReadingResponse
  listeningRationale: Text
  writing: Text
  writingReview: Text
  speaking: Text
  speakingReview: Text
  consultationReview: Text
}

/** Original authored practice, not copied examination material or a certified level assessment. */
export const starterUnits: StarterUnit[] = [
  {
    key: 'study-habits',
    title: t('Bài 1 · Thói quen học tập', 'Unit 1 · Study habits'),
    objectives: t(
      'Tìm ý chính và chi tiết; nghe lịch sinh hoạt; viết email đề xuất; nói về một thói quen và đưa ví dụ.',
      'Identify a main idea and supporting details; listen for a routine; write a suggestion email; describe a habit with an example.',
    ),
    vocabulary: t(
      'routine — thói quen hằng ngày; distraction — điều gây xao nhãng; realistic — thực tế; review — ôn lại; progress — tiến bộ; consistent — đều đặn.',
      'routine — a usual sequence of activities; distraction — something that takes attention away; realistic — possible in the circumstances; review — study something again; progress — improvement over time; consistent — happening regularly.',
    ),
    passage: `A small change at the study club

When a neighbourhood study club opened, its members planned to study English for two hours every evening. After the first week, only four of the twelve members were still following the plan. Several people worked late, and others found a long session difficult after a tiring day. The organiser, Maya, decided to ask members what they could realistically do.

The group replaced the long sessions with a twenty-minute routine on four weekdays. Members spent five minutes reviewing yesterday's words, ten minutes reading or listening to something new, and five minutes explaining one idea aloud. They could choose their own study time. The club met on Saturday mornings to compare notes and ask questions.

One member, Daniel, used to study with his phone beside his book. A message often interrupted him, and checking it usually led to several more minutes online. He began leaving his phone in another room during his short session. He did not believe phones were always harmful: he still used a dictionary app after reading. His aim was to choose when to use the device instead of responding to every notification.

After a month, the club did not hold an exam or claim that everyone had reached a new language level. Instead, members checked a simple record of the days they had studied and shared one thing they could now explain more clearly. Ten members had followed the new routine on most planned days. Maya concluded that a manageable plan and regular reflection had helped people return to learning, even when life was busy. The club kept its flexible schedule and agreed to review it again the following month.`,
    reading: questions([
      single('r1', 'Why did the club change its original plan?', [
        'The members wanted to prepare for an exam.',
        'Most members could not maintain the long daily sessions.',
        'The organiser stopped teaching English.',
      ]),
      short('r2', 'How many minutes of each new session were used to explain an idea aloud?', 1),
      single('r3', 'What does Daniel think about his phone?', [
        'It can be useful when he chooses when to use it.',
        'It should never be used for language learning.',
        'Messages improve his concentration.',
      ]),
      short('r4', 'On which day did the club meet to compare notes?', 1),
      single('r5', 'What evidence did members use to review the new plan?', [
        'An official language certificate.',
        'The number of dictionary apps they installed.',
        'Their study records and clearer explanations.',
      ]),
    ]),
    readingAnswers: { r1: 'b', r2: 'five', r3: 'a', r4: 'Saturday', r5: 'c' },
    readingRationale: t(
      '1: Đoạn 1 chỉ còn 4/12 người duy trì. 2: five hoặc 5; đoạn 2. 3: Daniel vẫn dùng từ điển sau khi đọc. 4: Saturday; đoạn 2. 5: Nhật ký học và điều giải thích rõ hơn, không phải chứng chỉ.',
      '1: Paragraph 1 says only four of twelve continued. 2: Accept five or 5; paragraph 2. 3: Daniel still uses a dictionary after reading. 4: Saturday; paragraph 2. 5: Study records and clearer explanations, not a certificate.',
    ),
    transcript: `Hello everyone. This is a short update about our English study club. Our next meeting will be on Saturday at ten thirty in the morning. We usually meet in the main library room, but it is being painted this week, so please come to the garden room instead. You can find it beside the small cafe.

Before the meeting, please choose one short article about a subject you enjoy. It does not need to be difficult. Read it once for the main idea, then choose three useful words. Write a sentence of your own for each word. Please do not copy every unfamiliar word into your notebook; a short list is easier to review.

At the meeting, each person will explain the article to a partner for two minutes. Your partner will ask one follow-up question. You do not need to memorise a speech. A few notes are enough, and mistakes are welcome because they show us what to practise next.

Bring your notebook and a pen. You can leave your laptop at home. If you cannot attend, send me a message by Friday evening so I can organise the pairs. I look forward to hearing what you have discovered.`,
    listening: questions([
      short('l1', 'What time does the meeting start? Write the time in numbers.', 1),
      short('l2', 'Which room will the club use this week?', 2),
      single('l3', 'What should members do with three useful words?', [
        'Copy every dictionary definition.',
        'Write their own sentence for each word.',
        'Memorise the whole article.',
      ]),
      short('l4', 'How many minutes will each person spend explaining the article?', 1),
      single('l5', 'What should a member do if they cannot attend?', [
        'Send a message by Friday evening.',
        'Bring a laptop the following week.',
        'Ask the cafe to change the time.',
      ]),
    ]),
    listeningAnswers: { l1: '10:30', l2: 'garden room', l3: 'b', l4: 'two', l5: 'a' },
    listeningRationale: t(
      '1: 10:30 hoặc 10.30. 2: garden room; main library room là địa điểm cũ. 3: Câu tự viết. 4: two hoặc 2. 5: Báo trước tối thứ Sáu.',
      '1: Accept 10:30 or 10.30. 2: garden room; the main library room is the old location. 3: Original sentences. 4: Accept two or 2. 5: Notify the organiser by Friday evening.',
    ),
    writing: t(
      'Viết email 120–150 từ bằng tiếng Anh cho một người bạn muốn học đều hơn. Nêu một khó khăn trong lịch học hiện tại, đề xuất hai thay đổi thực tế, giải thích mỗi thay đổi và hỏi ý kiến bạn. Dùng lời chào, các đoạn rõ ràng và lời kết. Bạn có thể lập sơ đồ ý trước khi viết. Đây là độ dài gợi ý, không phải bài thi chính thức.',
      'Write a 120–150 word email in English to a friend who wants to study more regularly. Describe one difficulty with their current routine, suggest two realistic changes, explain each suggestion, and ask for their opinion. Include a greeting, clear paragraphs and a closing. You may plan with a mind map first. This is a suggested practice length, not an official test.',
    ),
    writingReview: t(
      'Kiểm tra đủ khó khăn, hai đề xuất có lý do và câu hỏi cuối; góp ý cách chia đoạn, should/could, hiện tại đơn và từ nối because/so. Không cho điểm chỉ dựa vào số từ. Yêu cầu học viên tự sửa một câu sau nhận xét.',
      'Check the difficulty, two explained suggestions and closing question. Review paragraphing, should/could, present simple and because/so. Do not grade on word count alone. Ask the learner to revise one sentence after feedback.',
    ),
    speaking: t(
      'Trả lời bằng tiếng Anh, khoảng 1–2 phút: Bạn thường học tiếng Anh vào lúc nào? Điều gì khiến bạn mất tập trung? Mô tả một thay đổi nhỏ bạn muốn thử tuần tới và giải thích vì sao. Nêu ít nhất một ví dụ từ việc học của bạn. Có thể ghi vài từ khóa trước khi ghi âm, không cần đọc bài viết sẵn.',
      'Answer in English for about 1–2 minutes: When do you usually study English? What distracts you? Describe one small change you want to try next week and explain why. Give at least one example from your own learning. You may prepare a few keywords before recording; you do not need to read a written script.',
    ),
    speakingReview: t(
      'Nghe xem câu trả lời có ví dụ, lý do và trình tự rõ không. Phản hồi riêng về độ trôi chảy, từ vựng, ngữ pháp và phát âm có bằng chứng nghe được. Không suy ra phát âm chỉ từ bản chép lời.',
      'Listen for a concrete example, a reason and a clear sequence. Give separate evidence-based comments on fluency, vocabulary, grammar and audible pronunciation. Do not infer pronunciation from a transcript alone.',
    ),
    consultationReview: t(
      'Buổi chính đầu tiên được miễn 1:1. Trước buổi chính 2, dùng 1:1 để học viên giải thích lại ý chính bài đọc, sửa một lỗi nghe và trình bày kế hoạch học đã chỉnh. Giáo viên chỉ xác nhận hoàn thành sau buổi review thực tế.',
      'The first main lesson is exempt from 1:1 review. Before main lesson 2, use the review to revisit the reading main idea, correct one listening error and explain a revised study plan. The teacher confirms completion only after an actual review.',
    ),
  },
  {
    key: 'shared-spaces',
    title: t('Bài 2 · Không gian chung', 'Unit 2 · Shared spaces'),
    objectives: t(
      'So sánh lựa chọn; nhận ra ý kiến có điều kiện; nghe thay đổi kế hoạch; viết đoạn đưa đề xuất có cân nhắc.',
      'Compare options; recognise a qualified opinion; listen for a change of plan; write a balanced recommendation.',
    ),
    vocabulary: t(
      'shared — dùng chung; accessible — dễ tiếp cận; reserve — đặt trước; equipment — thiết bị; volunteer — tình nguyện viên; alternative — lựa chọn khác.',
      'shared — used by more than one person; accessible — easy to reach or use; reserve — arrange to use later; equipment — tools needed for an activity; volunteer — someone who helps without payment; alternative — another possible choice.',
    ),
    passage: `A room with more than one purpose

The residents of a small apartment building had an unused room on the ground floor. Some wanted a quiet reading area; others preferred a place to repair household objects. Buying separate equipment for both ideas would have cost more than the residents could spend. Instead of voting immediately, the building committee invited people to test a shared arrangement for six weeks.

On weekday mornings the room became a reading space with a few movable tables. On Wednesday evenings, volunteers used the same tables for a repair workshop. Residents could bring a loose chair leg or a broken lamp and learn how to examine it safely. Volunteers did not promise to repair everything, and electrical work was handled only by a suitably qualified person. The aim was to share practical knowledge, not to offer a free repair service for every object.

The first workshop was noisy, and a resident who worked from home complained. Moving the workshop to an earlier hour would not have helped because many volunteers were still at work then. The committee instead moved one table away from the shared wall and added a clear finishing time. After that, the resident said the sound was easier to manage.

At the end of the trial, the committee asked about access as well as popularity. The doorway was wide enough for a wheelchair, but boxes sometimes blocked the route. A marked storage area solved that problem. The residents chose to continue the arrangement, while keeping one evening free for other activities. They learned that sharing a room involved more than putting two names on a timetable: it required listening to people who used the space differently.`,
    reading: questions([
      single('r1', 'Why did the committee try a shared arrangement?', [
        'The building had two empty rooms.',
        'Separate equipment would exceed the available budget.',
        'Every resident wanted a repair business.',
      ]),
      short('r2', 'How many weeks did the trial last?', 1),
      single('r3', 'What was the main purpose of the repair workshop?', [
        'To share practical knowledge.',
        'To guarantee all objects would be repaired.',
        'To replace qualified electrical workers.',
      ]),
      single('r4', 'Which change helped with the noise problem?', [
        'Moving every workshop to the morning.',
        'Closing the room permanently.',
        'Moving a table and setting a clear finishing time.',
      ]),
      short('r5', 'What sometimes blocked the accessible route?', 1),
    ]),
    readingAnswers: { r1: 'b', r2: 'six', r3: 'a', r4: 'c', r5: 'boxes' },
    readingRationale: t(
      '1: Ngân sách không đủ mua riêng. 2: six hoặc 6. 3: Đoạn 2 phân biệt chia sẻ kỹ năng với bảo đảm sửa mọi đồ vật. 4: Hai biện pháp ở đoạn 3. 5: boxes.',
      '1: The budget could not cover separate equipment. 2: Accept six or 6. 3: Paragraph 2 distinguishes learning from guaranteed repairs. 4: Both changes appear in paragraph 3. 5: boxes.',
    ),
    transcript: `Good afternoon. Here are the arrangements for Sunday's community skills morning. We originally planned to hold the event outside, but heavy rain is expected, so all activities will take place in the community hall. The doors open at nine fifteen, and the first workshop starts at nine thirty.

There will be two activities. At the repair table, a volunteer will show you how to check a bicycle tyre and adjust the seat. Please bring your own bicycle if possible. We will provide the basic tools, so you do not need to buy any. The second activity is a small plant exchange. Bring one healthy plant with a label showing its name and the amount of light it needs. You may also come just to ask questions.

There is no entry fee, but we ask everyone to reserve a place by Thursday because the hall has limited space. Please tell us if you need step-free access. The side entrance has a ramp, and a volunteer will be there to help you find it.

Both activities finish at eleven. Afterwards, we would appreciate a few volunteers staying for fifteen minutes to put the tables away. Thank you for helping us keep the space useful for everyone.`,
    listening: questions([
      single('l1', 'Why has the event moved indoors?', [
        'The hall is cheaper.',
        'Heavy rain is expected.',
        'The bicycles need electricity.',
      ]),
      short('l2', 'What time does the first workshop start? Write the time in numbers.', 1),
      single('l3', 'What will the organisers provide for the bicycle activity?', [
        'Basic tools.',
        'A new bicycle for each visitor.',
        'A plant for every table.',
      ]),
      short('l4', 'By which day should people reserve a place?', 1),
      short('l5', 'Which entrance has a ramp?', 2),
    ]),
    listeningAnswers: { l1: 'b', l2: '9:30', l3: 'a', l4: 'Thursday', l5: 'side entrance' },
    listeningRationale: t(
      '1: Dự báo mưa lớn. 2: 9:30 hoặc 9.30; 9:15 là giờ mở cửa. 3: basic tools. 4: Thursday. 5: side entrance; chấp nhận side.',
      '1: Heavy rain is forecast. 2: Accept 9:30 or 9.30; 9:15 is the door-opening time. 3: Basic tools. 4: Thursday. 5: side entrance; accept side.',
    ),
    writing: t(
      'Tòa nhà có một phòng trống. Viết đề xuất 140–170 từ bằng tiếng Anh: nên dùng phòng làm nơi học yên tĩnh, nơi sinh hoạt nhóm, hay kết hợp cả hai? Nêu lựa chọn của bạn, hai lý do, một khó khăn và cách giải quyết. Không cần thêm số liệu ngoài đề. Dùng ví dụ cụ thể và chia đoạn rõ.',
      'Your building has an empty room. Write a 140–170 word proposal in English: should it become a quiet study space, a group activity room, or a combination? State your choice, give two reasons, identify one difficulty and suggest a solution. You do not need external statistics. Use a concrete example and clear paragraphs.',
    ),
    writingReview: t(
      'Không có lựa chọn đúng duy nhất. Tìm quan điểm nhất quán, hai lý do, vấn đề và giải pháp liên quan. Góp ý although/however, so sánh và liên kết đại từ. Phân biệt lỗi làm sai nghĩa với lỗi nhỏ.',
      'There is no single correct choice. Look for a consistent position, two reasons and a relevant problem/solution. Review although/however, comparisons and reference words. Distinguish meaning-changing errors from minor slips.',
    ),
    speaking: t(
      'Nói bằng tiếng Anh trong 1–2 phút về một nơi công cộng bạn thường dùng. Nơi đó phục vụ ai? Điều gì đang hoạt động tốt? Bạn muốn thay đổi một điều gì và thay đổi đó ảnh hưởng tới người khác ra sao? So sánh ít nhất hai cách sử dụng không gian.',
      'Speak in English for 1–2 minutes about a public place you use. Who uses it? What works well? What one thing would you change, and how might it affect other people? Compare at least two ways of using the space.',
    ),
    speakingReview: t(
      'Tìm một so sánh rõ, ví dụ và cách cân nhắc người dùng khác. Hỏi thêm: What might be difficult about your suggestion? Nhận xét bốn tiêu chí riêng và chọn một mục tiêu sửa ở lần nói lại.',
      'Look for a clear comparison, an example and consideration of other users. Follow up: What might be difficult about your suggestion? Comment on the four criteria separately and choose one target for a second attempt.',
    ),
    consultationReview: t(
      'Trước buổi chính 3, review bài 2: học viên giải thích một đáp án nghe dễ nhầm, bảo vệ đề xuất bằng một lý do và sửa một câu so sánh. Liên kết buổi 1:1 với buổi chính kế tiếp; không chỉ đánh dấu có đặt lịch.',
      'Before main lesson 3, review unit 2: explain one listening distractor, support a proposal with a reason and revise one comparison. Link the consultation to the next main lesson; a reservation alone is not completion.',
    ),
  },
  {
    key: 'everyday-decisions',
    title: t('Bài 3 · Quyết định hằng ngày', 'Unit 3 · Everyday decisions'),
    objectives: t(
      'Theo dõi thay đổi theo thời gian; phân biệt kết quả với nguyên nhân suy đoán; nghe thông tin cập nhật; giải thích lựa chọn có bằng chứng.',
      'Follow change over time; distinguish an observation from an assumed cause; listen for updated information; explain a choice using evidence.',
    ),
    vocabulary: t(
      'option — phương án; reliable — đáng tin cậy; compare — so sánh; estimate — ước tính; delay — sự chậm trễ; evidence — bằng chứng.',
      'option — a possible choice; reliable — able to be trusted; compare — consider similarities and differences; estimate — a rough calculation; delay — something happening later than expected; evidence — information supporting a conclusion.',
    ),
    passage: `Choosing a journey, not just a ticket

For years, Lina drove to a language class across town. When parking fees increased, she decided to compare driving with taking the bus. A friend said the bus would certainly be faster, but Lina wanted to check her own route before making a decision. She recorded the time from leaving her front door to reaching the classroom, rather than comparing only the time spent in a vehicle.

During the first week, she drove on two evenings and took the bus on two others. Driving took around thirty-five minutes, including the search for a parking space. The bus journey took about forty minutes because she had to walk to the stop and wait. The difference was smaller than she expected. On the bus she could review her class notes, while driving required her full attention.

The following week, roadworks delayed both forms of transport. One bus arrived twenty minutes late, and Lina missed the beginning of class. She nearly stopped the comparison, but realised that a single difficult journey did not describe every evening. She added a note about the roadworks instead of removing the delayed trip from her record.

After four weeks, Lina chose the bus for most class evenings and kept driving as an alternative when she needed to carry heavy materials. Her decision considered cost, reliability and how she wanted to use her time. She did not conclude that buses were always better for everyone. Someone with a different route or an earlier class could reasonably choose another option. For Lina, keeping a simple record made the trade-offs clearer and helped her explain her choice without relying only on one good or bad experience.`,
    reading: questions([
      single('r1', 'What did Lina measure?', [
        'Only the time inside the bus.',
        'The full journey from her door to the classroom.',
        'The length of the language lesson.',
      ]),
      short('r2', 'Approximately how many minutes did driving take in the first week?', 1),
      single('r3', 'How did Lina handle the delayed bus journey in her record?', [
        'She removed it.',
        'She replaced it with an estimate.',
        'She kept it and noted the roadworks.',
      ]),
      short('r4', 'What could Lina review while travelling by bus?', 2),
      single('r5', 'Which statement best reflects Lina’s conclusion?', [
        'The bus suited most of her own class journeys.',
        'Driving is always an unreasonable choice.',
        'One journey is enough to compare transport options.',
      ]),
    ]),
    readingAnswers: { r1: 'b', r2: '35', r3: 'c', r4: 'class notes', r5: 'a' },
    readingRationale: t(
      '1: Đoạn 1 tính cả đi bộ/chờ/tìm chỗ đỗ. 2: 35 hoặc thirty-five. 3: Giữ chuyến trễ và ghi nguyên nhân bối cảnh. 4: class notes hoặc notes. 5: Kết luận giới hạn cho hoàn cảnh của Lina.',
      '1: Paragraph 1 includes the full journey. 2: Accept 35 or thirty-five. 3: She kept the delayed trip with contextual notes. 4: Accept class notes or notes. 5: The conclusion is limited to Lina’s circumstances.',
    ),
    transcript: `Hello, this is an update for everyone attending tomorrow's visit to the science centre. Please read the revised travel details carefully. We had planned to meet at the central station at eight forty-five. Because some trains are being replaced by buses, we will now meet outside the centre itself at nine twenty. The guided visit still begins at nine thirty.

If you are travelling from the west side of town, bus number eighteen stops opposite the centre. The walk from that stop takes about five minutes. Please allow extra time in case traffic is slow. We cannot delay the guided visit for late arrivals, but a member of staff can help you join the group after you arrive.

Bring your booking confirmation on your phone or on paper. You do not need to print it if the screen is clear. The centre has lockers for large bags, but please keep your notebook with you. You will use it to record one surprising fact and one question during the visit.

There is a cafe inside, although lunch is not included in the booking. You may bring your own food and use the picnic area if the weather is dry. We expect to finish at half past twelve. After that, everyone will make their own journey home.`,
    listening: questions([
      short('l1', 'What time should the group now meet? Write the time in numbers.', 1),
      single('l2', 'Where is the new meeting point?', [
        'Inside the central station.',
        'Outside the science centre.',
        'In the picnic area.',
      ]),
      short('l3', 'Which bus number stops opposite the centre?', 1),
      single('l4', 'What does the speaker say about the booking confirmation?', [
        'It must always be printed.',
        'A clear phone screen or paper copy is acceptable.',
        'It is not needed.',
      ]),
      short('l5', 'What time is the visit expected to finish? Write the time in numbers.', 1),
    ]),
    listeningAnswers: { l1: '9:20', l2: 'b', l3: '18', l4: 'b', l5: '12:30' },
    listeningRationale: t(
      '1: 9:20 hoặc 9.20; 8:45 là kế hoạch cũ, 9:30 bắt đầu tham quan. 2: Bên ngoài trung tâm. 3: 18 hoặc eighteen. 4: Chấp nhận điện thoại hoặc giấy. 5: 12:30 hoặc 12.30.',
      '1: Accept 9:20 or 9.20; 8:45 was the old plan and 9:30 is the tour start. 2: Outside the centre. 3: Accept 18 or eighteen. 4: Phone or paper is acceptable. 5: Accept 12:30 or 12.30.',
    ),
    writing: t(
      'Một người bạn đang chọn giữa học trực tuyến và học tại lớp. Viết 150–180 từ bằng tiếng Anh so sánh hai phương án cho hoàn cảnh cụ thể của bạn ấy. Tự nêu rõ một giả định hợp lý về lịch sinh hoạt, đưa ra một lợi ích và một hạn chế của mỗi phương án, rồi khuyến nghị kèm lý do. Không bịa số liệu nghiên cứu hoặc bảo đảm kết quả.',
      'A friend is choosing between online lessons and classroom lessons. Write 150–180 words in English comparing the options for that friend’s circumstances. State one reasonable assumption about their schedule, give one benefit and one limitation of each option, and make a reasoned recommendation. Do not invent research statistics or guarantee outcomes.',
    ),
    writingReview: t(
      'Tìm giả định được nói rõ, so sánh công bằng và kết luận theo hoàn cảnh. Góp ý cách dùng if, while, more/less và cách nối ví dụ với lý do. Không yêu cầu học viên có cùng lựa chọn với giáo viên.',
      'Look for an explicit assumption, a fair comparison and a context-dependent conclusion. Review if, while, more/less and links between examples and reasons. Do not require the learner to choose the teacher’s preferred option.',
    ),
    speaking: t(
      'Nói 1–2 phút bằng tiếng Anh về một quyết định gần đây: Bạn có những lựa chọn nào? Bạn dùng thông tin gì để so sánh? Bạn đã chọn gì và sẽ thay đổi điều gì nếu làm lại? Dùng một ví dụ cụ thể, phân biệt điều bạn biết với điều bạn chỉ dự đoán.',
      'Speak in English for 1–2 minutes about a recent decision. What options did you have? What information helped you compare them? What did you choose, and what would you change next time? Give a concrete example and distinguish what you know from what you only expect.',
    ),
    speakingReview: t(
      'Nghe cách sắp xếp trước–sau, lý do và ví dụ. Kiểm tra quá khứ đơn, cách diễn đạt giả định và trọng âm từ khóa. Chỉ nhận xét phát âm dựa trên bản ghi nghe được; để trống tiêu chí nếu bằng chứng chưa đủ.',
      'Listen for sequencing, reasons and examples. Review past simple, hypothetical language and stress on key words. Comment on pronunciation only from audible evidence; leave a criterion unscored if evidence is insufficient.',
    ),
    consultationReview: t(
      'Review tổng kết bài 3: học viên giải thích một thông tin lịch bị thay đổi, nhận diện một suy đoán trong lập luận và nói lại quyết định với ví dụ rõ hơn. Chỉ tạo lịch tiếp theo khi đã có ngày, giáo viên và lớp thực tế.',
      'Review unit 3: explain one changed schedule detail, identify an assumption in an argument and retell a decision with a clearer example. Schedule later lessons only when actual dates, teachers and class arrangements are known.',
    ),
  },
]

export const starterMetadata = {
  id: 'original-english-starter-v1',
  title: t('English Foundations · 3 bài học khởi đầu', 'English Foundations · 3 starter units'),
  description: t(
    'Học liệu gốc tự biên soạn cho thực hành B1/tiền IELTS, cần giáo viên duyệt độ khó và nội dung trước khi công bố. Có 12 bài tập, 3 audio giọng tổng hợp ngoại tuyến và hướng dẫn giáo viên riêng. Không phải đề thi chính thức hay cam kết band điểm.',
    'Original practice materials intended for B1/pre-IELTS study, pending teacher review of difficulty and content before publication. Includes 12 assignments, 3 offline synthetic-speech recordings and a separate teacher guide. Not an official examination or a band-score guarantee.',
  ),
  unitCount: 3,
  assignmentCount: 12,
  audioCount: 3,
}
