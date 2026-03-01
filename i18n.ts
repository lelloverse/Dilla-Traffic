import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations } from './translations/index';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: translations.en
      },
      am: {
        translation: translations.am
      }
    },
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;