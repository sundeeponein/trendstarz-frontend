export type UserTagRole = 'influencer' | 'brand' | 'photographer' | 'commission';

export interface UserTagVisibilityItem {
  name: string;
  visible: boolean;
}

export type UserTagOptionsMap = Record<UserTagRole, string[]>;
export type UserTagVisibilityMap = Record<UserTagRole, UserTagVisibilityItem[]>;

export const DEFAULT_USER_TAG_OPTIONS: UserTagOptionsMap = {
  influencer: ['Founder', 'Internal Creator', 'Verified Creator', 'Featured Creator'],
  brand: ['Founder-owned', 'Partner Brand', 'Early Access Brand', 'Verified Brand'],
  photographer: ['Founder', 'Internal Creator', 'Verified Creator', 'Featured Creator'],
  commission: ['Early Access', 'Partner', 'Internal/Test'],
};

export const buildDefaultUserTagOptions = (): UserTagOptionsMap => ({
  influencer: [...DEFAULT_USER_TAG_OPTIONS.influencer],
  brand: [...DEFAULT_USER_TAG_OPTIONS.brand],
  photographer: [...DEFAULT_USER_TAG_OPTIONS.photographer],
  commission: [...DEFAULT_USER_TAG_OPTIONS.commission],
});

export const buildDefaultUserTagVisibilityOptions = (): UserTagVisibilityMap => ({
  influencer: DEFAULT_USER_TAG_OPTIONS.influencer.map((name) => ({ name, visible: true })),
  brand: DEFAULT_USER_TAG_OPTIONS.brand.map((name) => ({ name, visible: true })),
  photographer: DEFAULT_USER_TAG_OPTIONS.photographer.map((name) => ({ name, visible: true })),
  commission: DEFAULT_USER_TAG_OPTIONS.commission.map((name) => ({ name, visible: true })),
});
