export type ReservationStatus = 'unknown' | 'limited' | 'closed';

export type BabyrooEvent = {
  id: string;
  csvSequence: number;
  title: string;
  venueName: string;
  locality: string;
  region: string;
  category: string;
  source: string;
  startsAt: string;
  endsAt: string;
  ageMinMonths?: number;
  ageMaxMonths?: number;
  indoor?: boolean;
  priceText?: string;
  priceType: 'free' | 'paid' | 'unknown';
  reservationRequired?: boolean;
  reservationStatus: ReservationStatus;
  guardianRequired?: boolean;
  tags: string[];
  summary: string;
  sourceUrl: string;
};

const eventsByCsvOrder: BabyrooEvent[] = [
  {
    id: 'seoul-culture-a583e1a836a5',
    csvSequence: 1,
    title: '[서울상상나라] 2F 기획전시 [사랑하는 모양이야]',
    venueName: '2층 서울형 키즈카페 시립 서울상상나라점',
    locality: '광진구',
    region: '서울',
    category: 'play_space',
    source: 'seoul_culture',
    startsAt: '2025-11-15',
    endsAt: '2026-11-15',
    ageMinMonths: 0,
    ageMaxMonths: 35,
    priceText: '입장료 별도',
    priceType: 'paid',
    reservationStatus: 'unknown',
    guardianRequired: true,
    tags: ['24개월이하', '보호자동반'],
    summary:
      '서울상상나라 2층에서 운영되는 기획전시와 영아 친화 공간입니다. 36개월 미만 영아와 보호자가 함께 이용할 수 있어요.',
    sourceUrl:
      'https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=156165&menuNo=200110',
  },
  {
    id: 'dikidiki-104109',
    csvSequence: 2,
    title: '영유아를 위한 <디키디키 × 프뢰벨 은물놀이> 프로그램 오픈!',
    venueName: '디키디키 내 프로그램실',
    locality: '중구',
    region: '서울',
    category: 'experience',
    source: 'dikidiki',
    startsAt: '2026-07-11',
    endsAt: '2026-08-22',
    ageMinMonths: 24,
    ageMaxMonths: 47,
    indoor: true,
    priceText: '어린이 1인 입장권 포함',
    priceType: 'paid',
    reservationRequired: true,
    reservationStatus: 'unknown',
    guardianRequired: true,
    tags: ['디키디키', '프뢰벨', '은물놀이', '24개월이상', '예약필요', '실내'],
    summary:
      '프뢰벨 은물 교구를 만지고 쌓고 연결하며 형태, 수, 방향, 색을 자연스럽게 경험하는 영아 프로그램입니다.',
    sourceUrl: 'https://dikidiki.co.kr/post2_detail.do?seq=104109&type=2',
  },
  {
    id: 'dikidiki-104108',
    csvSequence: 3,
    title: '디키디키 촉감놀이터, 현대백화점 문화센터 순회 운영 안내',
    venueName: '현대백화점 문화센터 각 지점',
    locality: '서울/경기',
    region: '서울/경기',
    category: 'experience',
    source: 'dikidiki',
    startsAt: '2026-07-26',
    endsAt: '2026-08-07',
    indoor: true,
    priceType: 'paid',
    reservationRequired: true,
    reservationStatus: 'unknown',
    guardianRequired: true,
    tags: ['디키디키', '촉감놀이터', '현대백화점문화센터', '예약필요', '실내'],
    summary:
      '정글 속 동물 친구들을 만나고 자연을 느끼며 상상력을 키우는 촉감놀이터 프로그램입니다. 현대백화점 여러 지점에서 운영돼요.',
    sourceUrl: 'https://dikidiki.co.kr/post2_detail.do?seq=104108&type=2',
  },
  {
    id: 'dikidiki-103871',
    csvSequence: 4,
    title: '[디키캠프 소식] 2026 여름방학 디키캠프 예약',
    venueName: '디키디키',
    locality: '중구',
    region: '서울',
    category: 'camp',
    source: 'dikidiki',
    startsAt: '2026-07-27',
    endsAt: '2026-08-06',
    ageMinMonths: 60,
    ageMaxMonths: 95,
    indoor: true,
    priceText: '특별혜택가 552,000원',
    priceType: 'paid',
    reservationRequired: true,
    reservationStatus: 'limited',
    guardianRequired: false,
    tags: ['디키캠프', '여름방학', '5세-8세', '돌봄서비스', '예약필요', '유료'],
    summary:
      '4일 동안 운영되는 여름방학 캠프입니다. 돌봄서비스, 테마별 프로그램, 점심식사와 간식, 놀이시간이 포함됩니다.',
    sourceUrl: 'https://dikidiki.co.kr/post2_detail.do?seq=103871&type=2',
  },
  {
    id: 'dikidiki-103725',
    csvSequence: 5,
    title: "DDP 디자인놀이터 디키디키가 '더현대 서울'로 향합니다!",
    venueName: '더현대 서울 6F CH1985',
    locality: '영등포구',
    region: '서울',
    category: 'experience',
    source: 'dikidiki',
    startsAt: '2026-03-01',
    endsAt: '2026-03-01',
    ageMinMonths: 36,
    indoor: true,
    priceText: '40,000원',
    priceType: 'paid',
    reservationRequired: true,
    reservationStatus: 'closed',
    guardianRequired: false,
    tags: ['디키디키', '플레이랩', '원데이클래스', '36개월이상', '예약필요', '실내'],
    summary:
      '더현대 서울 문화센터에서 열리는 디키디키 원데이 플레이랩입니다. 수업 50분과 디키블록 플레이 20분으로 구성됩니다.',
    sourceUrl: 'https://dikidiki.co.kr/post2_detail.do?seq=103725&type=2',
  },
];

export const eventsNewestFirst = [...eventsByCsvOrder].reverse();

export const recommendedEvents = eventsNewestFirst.slice(0, 3);
