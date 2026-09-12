import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'fa' | 'en';

const translations = {
  fa: {
    appName: 'DARK VPN',
    settings: 'تنظیمات',
    routing: 'مسیریابی',
    bypassIran: 'حذف ایران',
    global: 'گلوبال',
    direct: 'مستقیم',
    dns: 'DNS',
    killSwitch: 'کیل‌سوییچ',
    clearAllConfigs: 'حذف همه کانفیگ‌ها',
    confirmClear: 'تأیید حذف',
    cancel: 'انصراف',
    close: 'بستن',
    language: 'زبان / Language',
    connected: 'متصل',
    connecting: 'در حال اتصال...',
    disconnected: 'قطع',
    error: 'خطا',
    search: 'جستجو...',
    download: 'دانلود',
    upload: 'آپلود',
    ping: 'پینگ',
    testAll: 'تست همه',
    testing: 'در حال تست...',
    addConfig: 'افزودن کانفیگ',
    subscriptions: 'سابسکریپشن‌ها',
    copyLink: 'کپی لینک',
    update: 'به‌روزرسانی',
    updateAll: 'به‌روزرسانی همه',
    delete: 'حذف',
    edit: 'ویرایش',
    save: 'ذخیره',
    name: 'نام',
  },
  en: {
    appName: 'DARK VPN',
    settings: 'Settings',
    routing: 'Routing',
    bypassIran: 'Bypass Iran',
    global: 'Global',
    direct: 'Direct',
    dns: 'DNS',
    killSwitch: 'Kill Switch',
    clearAllConfigs: 'Clear All Configs',
    confirmClear: 'Confirm Delete',
    cancel: 'Cancel',
    close: 'Close',
    language: 'Language / زبان',
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Error',
    search: 'Search...',
    download: 'Download',
    upload: 'Upload',
    ping: 'Ping',
    testAll: 'Test All',
    testing: 'Testing...',
    addConfig: 'Add Config',
    subscriptions: 'Subscriptions',
    copyLink: 'Copy Link',
    update: 'Update',
    updateAll: 'Update All',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    name: 'Name',
  },
};

interface I18nContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: typeof translations['fa'];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('fa');

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
};
