export const APP_THEME_IDS = [
  'noir',
  'paper',
  'gold',
  'ocean',
  'sage',
  'ember',
  'slate',
  'rose',
  'sand',
  'neon',
] as const;

export type AppThemeId = (typeof APP_THEME_IDS)[number];

export type AppThemeOption = {
  id: AppThemeId;
  label: string;
};

export const APP_THEME_OPTIONS: AppThemeOption[] = [
  { id: 'noir', label: 'Noir' },
  { id: 'paper', label: 'Paper' },
  { id: 'gold', label: 'Gold' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sage', label: 'Sage' },
  { id: 'ember', label: 'Ember' },
  { id: 'slate', label: 'Slate' },
  { id: 'rose', label: 'Rose' },
  { id: 'sand', label: 'Sand' },
  { id: 'neon', label: 'Neon' },
];

export const APP_THEME_STORAGE_KEY = 'th3scr1b3_app_theme_v1';
export const DEFAULT_APP_THEME_ID: AppThemeId = APP_THEME_OPTIONS[0].id;

export function isAppThemeId(value: string | null | undefined): value is AppThemeId {
  return Boolean(value && APP_THEME_IDS.includes(value as AppThemeId));
}
