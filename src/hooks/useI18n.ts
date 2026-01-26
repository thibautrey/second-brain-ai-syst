import { useTranslation } from 'i18next-react';

export const useI18n = () => {
  const { t } = useTranslation();
  return t;
};
