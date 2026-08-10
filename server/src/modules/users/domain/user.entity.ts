export type ChildGender = 'female' | 'male' | 'unknown';

export type Child = {
  id: string;
  nickname: string;
  birthDate: string;
  gender: ChildGender;
};

export type UserHomeAddress = {
  address: string;
  roadAddress?: string;
  jibunAddress?: string;
  detailAddress?: string;
  zonecode?: string;
  sido?: string;
  sigungu?: string;
  bname?: string;
  buildingName?: string;
};

export type User = {
  id: string;
  displayName: string;
  children: Child[];
  activeChildIds: string[];
  homeRegion: string;
  homeAddress?: UserHomeAddress;
  preferredLocalities: string[];
  createdAt: string;
  updatedAt: string;
};

export type UpsertUserInput = {
  id: string;
  displayName?: string;
};

export type UpdateUserProfileInput = Partial<
  Pick<User, 'displayName' | 'homeRegion' | 'homeAddress' | 'preferredLocalities' | 'activeChildIds'>
>;

export type CreateChildInput = {
  nickname: string;
  birthDate: string;
  gender?: ChildGender;
};

export type UpdateChildInput = Partial<CreateChildInput>;

