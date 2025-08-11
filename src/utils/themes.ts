import { lightTheme, darkTheme } from '~/renderer/constants/themes';

export const getTheme = (name: string) => {
  if (name === 'selenix-light') return lightTheme;
  else if (name === 'selenix-dark') return darkTheme;
  return lightTheme;
};
