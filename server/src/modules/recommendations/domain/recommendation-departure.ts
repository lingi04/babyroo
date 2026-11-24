import type { DepartureArea } from './recommendation.entity';

const REGION_NAMES: Readonly<Record<string, string>> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천',
  광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종',
  경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북',
  충청남도: '충남', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남',
  경상북도: '경북', 경상남도: '경남', 제주도: '제주', 제주특별자치도: '제주',
};
const regions = new Set(Object.values(REGION_NAMES));

export function departureArea(region: unknown, locality: unknown): DepartureArea | undefined {
  if (typeof region !== 'string') return undefined;
  const normalized = Object.hasOwn(REGION_NAMES, region) ? REGION_NAMES[region] : region;
  if (!regions.has(normalized)) return undefined;
  return {
    region: normalized,
    locality: typeof locality === 'string' &&
      /^[가-힣]{1,10}[시군구]( [가-힣]{1,10}구)?$/.test(locality)
      ? locality
      : undefined,
  };
}
