// Management navigation and presentation for the prebuilt React application.
// All requests use the existing authenticated API client and backend contracts.
export const managementModules = {
  documents: { title: 'اسناد و مدارک', description: 'اسناد ملکی و مدارک مشتریان؛ مرتب، مرتبط و در دسترس', icon: 'file' },
  transactions: { title: 'مدیریت قراردادها', description: 'مبایعه‌نامه، اجاره‌نامه و سوابق مالی معاملات', icon: 'contract' },
  report: { title: 'گزارش عملکرد', description: 'شاخص‌های دفتر، بازدهی مشاوران و حجم معاملات', icon: 'chart' },
  branches: { title: 'مدیریت شعب', description: 'شعب تابعه، مدیران شعب و ساختار دفتر', icon: 'building' },
  agents: { title: 'مدیریت مشاورین', description: 'پرونده کاری، سطح دسترسی و انتقال مسئولیت‌ها', icon: 'users' },
  settings: { title: 'تنظیمات دفتر', description: 'نام، اطلاعات تماس و نشانی آژانس', icon: 'settings' },
  audit: { title: 'گزارش ممیزی', description: 'رخدادهای ثبت‌شده و تاریخچه تغییرات آژانس', icon: 'shield' },
  security: { title: 'امنیت و گذرواژه', description: 'تغییر گذرواژه و پایان دادن به نشست‌های قبلی', icon: 'lock' },
  subscription: { title: 'اشتراک و پلن', description: 'وضعیت اشتراک و ظرفیت‌های دفتر', icon: 'building' }
};
const managers = ['ADMIN', 'OWNER', 'BRANCH_MANAGER'];
export function canOpenModule(module, role) {
  if (module === 'hub') return true;
  if (!managementModules[module] || !role) return false;
  if (['documents', 'transactions', 'security'].includes(module)) return true;
  if (module === 'settings') return ['ADMIN', 'OWNER'].includes(role);
  return managers.includes(role);
}

export function createManagementUI(React, api) {
  const h = React.createElement;
  const paths = {
    file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'],
    contract: ['M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'm16 3 5 5-9 9-5 1 1-5Z'],
    chart: ['M4 3v17h17', 'm7 14 4-5 4 3 5-7'],
    building: ['M4 21V5h10v16', 'M14 11h6v10', 'M8 9h2', 'M8 13h2', 'M8 17h2', 'M2 21h20'],
    users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M16 3a4 4 0 0 1 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87'],
    settings: ['M12 3v3', 'M12 18v3', 'm3 12 3 0', 'm18 12 3 0', 'm5.6 5.6 2.1 2.1', 'm16.3 16.3 2.1 2.1', 'm5.6 18.4 2.1-2.1', 'm16.3 7.7 2.1-2.1'],
    shield: ['m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7Z', 'm8 12 3 3 5-6'],
    lock: ['M5 10h14v11H5Z', 'M8 10V6a4 4 0 0 1 8 0v4', 'M12 14v3'],
    arrow: ['m9 5 7 7-7 7'],
    calendar: ['M4 5h16v16H4Z', 'M8 3v4', 'M16 3v4', 'M4 11h16']
  };
  function Icon({ name, className = '' }) {
    return h('svg', { className: `mt-icon ${className}`, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      ...(paths[name] || paths.file).map((d, key) => h('path', { d, key })),
      name === 'users' ? h('circle', { cx: 9, cy: 7, r: 4 }) : null,
      name === 'settings' ? h('circle', { cx: 12, cy: 12, r: 4 }) : null);
  }
  function Hub({ role, onOpen, onTasks }) {
    const groups = [
      { title: 'پرونده‌ها و معاملات', detail: 'ابزارهای روزانه دفتر', items: ['documents', 'transactions'] },
      { title: 'مدیریت آژانس و نظارت', detail: 'بر اساس سطح دسترسی شما', items: ['report', 'branches', 'agents', 'settings', 'audit'] },
      { title: 'حساب کاربری و امکانات', detail: 'امنیت و برنامه‌ریزی', items: ['security', 'subscription', 'calendar'] }
    ];
    return h('div', { className: 'mt-management-hub' }, groups.map(group => {
      const items = group.items.filter(id => id === 'calendar' || canOpenModule(id, role));
      if (!items.length) return null;
      return h('section', { className: 'mt-hub-group', key: group.title, 'aria-label': group.title },
        h('div', { className: 'mt-group-heading' }, h('h3', null, group.title), h('p', null, group.detail)),
        h('div', { className: 'mt-hub-grid' }, items.map(id => {
          const item = id === 'calendar' ? { title: 'تقویم و پیگیری‌ها', description: 'بازدیدها، تماس‌ها و برنامه کاری', icon: 'calendar' } : managementModules[id];
          return h('button', { type: 'button', className: 'mt-module-card', key: id, onClick: () => id === 'calendar' ? onTasks?.('tasks') : onOpen(id), 'data-module-link': id },
            h('span', { className: 'mt-card-icon' }, h(Icon, { name: item.icon })),
            h('span', { className: 'mt-card-copy' }, h('strong', null, item.title), h('span', null, item.description)),
            h(Icon, { name: 'arrow', className: 'mt-card-arrow' }));
        })));
    }));
  }
  function Page({ module, onBack, children }) {
    const container = React.useRef(null);
    React.useEffect(() => {
      window.scrollTo(0, 0);
      container.current?.focus({ preventScroll: true });
    }, [module]);
    return h('section', { ref: container, tabIndex: -1, className: 'melktak-module', 'data-module': module, dir: 'rtl', 'aria-label': managementModules[module]?.title || 'مدیریت آژانس' },
      h('div', { className: 'mt-breadcrumb' }, h('button', { type: 'button', onClick: onBack }, h(Icon, { name: 'arrow' }), 'بازگشت به بیشتر'),
        h('span', { 'aria-hidden': true }, '/'), h('span', null, managementModules[module]?.title)),
      h('div', { className: 'mt-module-content' }, children));
  }
  function Heading({ module }) {
    const item = managementModules[module];
    return h('header', { className: 'mt-page-heading' }, h('span', { className: 'mt-card-icon' }, h(Icon, { name: item.icon })),
      h('div', null, h('h1', null, item.title), h('p', null, item.description)));
  }
  function Notice({ children, error = false }) {
    return children ? h('div', { className: `mt-notice${error ? ' mt-notice-error' : ''}`, role: error ? 'alert' : 'status' }, children) : null;
  }
  function Field({ label, name, ...props }) {
    return h('label', { className: 'mt-field' }, h('span', null, label),
      props.multiline ? h('textarea', { ...props, multiline: undefined, name, rows: 3 }) : h('input', { name, ...props }));
  }
  function Settings({ auth, onRefresh }) {
    const [values, setValues] = React.useState(() => ({ name: auth.tenant?.name || '', phone: auth.tenant?.phone || '', address: auth.tenant?.address || '' }));
    const [busy, setBusy] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const change = event => { setValues({ ...values, [event.target.name]: event.target.value }); setResult(null); };
    const submit = async event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setResult(null);
      try {
        const response = await api.patch('/api/v1/agency/settings', { ...values, name: values.name.trim() });
        if (!response.success) throw new Error(response.error?.message || 'ذخیره تنظیمات انجام نشد.');
        setResult({ text: 'اطلاعات دفتر با موفقیت ذخیره شد.' });
        await auth.refreshAuth?.();
        onRefresh?.();
      } catch (error) { setResult({ error: true, text: error.message || 'ارتباط با سرور برقرار نشد.' }); }
      finally { setBusy(false); }
    };
    return h(React.Fragment, null, h(Heading, { module: 'settings' }),
      h('div', { className: 'mt-page-columns' }, h('form', { className: 'mt-panel mt-form', onSubmit: submit, 'aria-label': 'اطلاعات دفتر' },
        h('h2', null, 'مشخصات آژانس'), h('p', { className: 'mt-muted' }, 'اطلاعات تماس دفتر را به‌روز نگه دارید.'),
        h(Field, { label: 'نام دفتر آژانس', name: 'name', value: values.name, onChange: change, minLength: 2, required: true, autoComplete: 'organization', disabled: busy }),
        h(Field, { label: 'تلفن دفتر', name: 'phone', value: values.phone, onChange: change, type: 'tel', dir: 'ltr', autoComplete: 'tel', disabled: busy }),
        h(Field, { label: 'نشانی دفتر', name: 'address', value: values.address, onChange: change, multiline: true, autoComplete: 'street-address', disabled: busy }),
        h(Notice, { error: result?.error }, result?.text),
        h('button', { className: 'mt-primary', type: 'submit', disabled: busy }, busy ? 'در حال ذخیره…' : 'ذخیره تغییرات')),
      h('aside', { className: 'mt-panel mt-info-panel' }, h(Icon, { name: 'building' }), h('h2', null, 'هویت دفتر شما'),
        h('p', null, 'این مشخصات برای معرفی دفتر در سامانه استفاده می‌شوند.'),
        h('dl', null, h('dt', null, 'کد آژانس'), h('dd', { dir: 'ltr' }, auth.tenant?.agency_code || '—')))));
  }
  function Security({ auth }) {
    const [values, setValues] = React.useState({ current_password: '', new_password: '', confirm_password: '' });
    const [visible, setVisible] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const submit = async event => {
      event.preventDefault(); if (busy) return;
      if (values.new_password !== values.confirm_password) { setResult({ error: true, text: 'گذرواژه جدید و تکرار آن یکسان نیستند.' }); return; }
      setBusy(true); setResult(null);
      try {
        const response = await api.post('/api/v1/auth/change-password', values);
        if (!response.success) throw new Error(response.error?.message || 'تغییر گذرواژه انجام نشد.');
        setValues({ current_password: '', new_password: '', confirm_password: '' });
        setResult({ text: 'گذرواژه تغییر کرد. برای ادامه با گذرواژه جدید وارد شوید.' });
        // The server revokes all sessions, including this one. Refresh clears authentication.
        await auth.refreshAuth?.();
      } catch (error) { setResult({ error: true, text: error.message || 'ارتباط با سرور برقرار نشد.' }); }
      finally { setBusy(false); }
    };
    return h(React.Fragment, null, h(Heading, { module: 'security' }),
      h('div', { className: 'mt-page-columns' }, h('form', { className: 'mt-panel mt-form', onSubmit: submit, 'aria-label': 'تغییر گذرواژه' },
        h('h2', null, 'تغییر گذرواژه حساب'),
        ...[['current_password', 'گذرواژه فعلی'], ['new_password', 'گذرواژه جدید'], ['confirm_password', 'تکرار گذرواژه جدید']].map(([name, label]) =>
          h(Field, { key: name, name, label, value: values[name], onChange: event => { setValues({ ...values, [name]: event.target.value }); setResult(null); }, required: true, minLength: name === 'new_password' ? 6 : 1, type: visible ? 'text' : 'password', dir: 'ltr', autoComplete: name === 'current_password' ? 'current-password' : 'new-password', disabled: busy })),
        h('label', { className: 'mt-checkbox' }, h('input', { type: 'checkbox', checked: visible, onChange: event => setVisible(event.target.checked) }), 'نمایش گذرواژه‌ها'),
        h(Notice, { error: result?.error }, result?.text),
        h('button', { className: 'mt-primary', type: 'submit', disabled: busy }, busy ? 'در حال تغییر…' : 'تغییر گذرواژه و خروج از نشست‌ها')),
      h('aside', { className: 'mt-panel mt-info-panel' }, h(Icon, { name: 'shield' }), h('h2', null, 'امنیت حساب شما'),
        h('p', null, 'گذرواژه جدید باید حداقل ۶ کاراکتر داشته باشد. از گذرواژه‌ای طولانی و منحصربه‌فرد استفاده کنید.'),
        h('p', null, 'پس از ذخیره، تمام نشست‌های قبلی بسته می‌شوند و باید دوباره وارد شوید.'))));
  }
  const auditLabels = {
    PROPERTY_CREATED: 'ثبت ملک جدید', PROPERTY_UPDATED: 'ویرایش اطلاعات ملک', PROPERTY_STATUS_CHANGED: 'تغییر وضعیت ملک',
    PROPERTY_ARCHIVED: 'بایگانی ملک', PROPERTY_RESTORED: 'بازیابی ملک', CUSTOMER_CREATED: 'ثبت مشتری جدید', CUSTOMER_UPDATED: 'ویرایش پرونده مشتری',
    TASK_CREATED: 'ثبت پیگیری جدید', TASK_COMPLETED: 'تکمیل پیگیری', TASK_CANCELLED: 'لغو پیگیری',
    TRANSACTION_CREATED: 'ثبت قرارداد', TRANSACTION_UPDATED: 'ویرایش قرارداد', TRANSACTION_DELETED: 'حذف قرارداد',
    DOCUMENT_UPLOADED: 'بارگذاری سند', DOCUMENT_UPDATED: 'ویرایش سند', DOCUMENT_ARCHIVED: 'بایگانی سند', DOCUMENT_RESTORED: 'بازیابی سند',
    LOGIN_SUCCESS: 'ورود موفق به سامانه', LOGIN_FAILED: 'تلاش ناموفق برای ورود', LOGOUT: 'خروج از حساب',
    PROFILE_UPDATED: 'ویرایش پروفایل کاربری', AGENCY_SETTINGS_UPDATED: 'بروزرسانی تنظیمات دفتر', PASSWORD_CHANGED: 'تغییر گذرواژه',
    AGENT_CREATED: 'افزودن مشاور', AGENT_UPDATED: 'ویرایش مشاور', AGENT_STATUS_CHANGED: 'تغییر وضعیت مشاور',
    BRANCH_CREATED: 'افزودن شعبه', BRANCH_UPDATED: 'ویرایش شعبه', BRANCH_DEACTIVATED: 'غیرفعال‌سازی شعبه', SYSTEM_BOOT: 'راه‌اندازی سامانه'
  };
  function Audit() {
    const [state, setState] = React.useState({ loading: true, logs: [], error: '' });
    const [refresh, setRefresh] = React.useState(0);
    const [search, setSearch] = React.useState('');
    const [page, setPage] = React.useState(1);
    React.useEffect(() => {
      let current = true;
      setState(previous => ({ ...previous, loading: true, error: '' }));
      api.get('/api/v1/agency/audit-logs').then(response => {
        if (!response.success) throw new Error(response.error?.message || 'دریافت گزارش انجام نشد.');
        if (current) { setState({ loading: false, logs: response.data || [], error: '' }); setPage(1); }
      }).catch(error => { if (current) setState({ loading: false, logs: [], error: error.message || 'ارتباط با سرور برقرار نشد.' }); });
      return () => { current = false; };
    }, [refresh]);
    const filtered = state.logs.filter(log => [log.title, log.description, log.action, log.entity_type].some(value => String(value || '').toLocaleLowerCase('fa').includes(search.trim().toLocaleLowerCase('fa'))));
    const pages = Math.max(1, Math.ceil(filtered.length / 10));
    const currentPage = Math.min(page, pages);
    return h(React.Fragment, null, h(Heading, { module: 'audit' }),
      h('div', { className: 'mt-panel mt-audit-toolbar' },
        h(Field, { label: 'جستجو در رخدادها', name: 'audit-search', type: 'search', value: search, placeholder: 'عنوان یا نوع تغییر…', onChange: event => { setSearch(event.target.value); setPage(1); } }),
        h('button', { type: 'button', className: 'mt-secondary', disabled: state.loading, onClick: () => setRefresh(value => value + 1) }, 'بروزرسانی گزارش')),
      h('p', { className: 'mt-muted' }, 'نمایش آخرین ۵۰ رخداد ثبت‌شده؛ ', filtered.length.toLocaleString('fa-IR'), ' رخداد در این فهرست'),
      state.error ? h(Notice, { error: true }, state.error) : null,
      state.loading ? h('div', { className: 'mt-panel mt-empty', role: 'status' }, 'در حال دریافت رخدادها…') : !state.error && !filtered.length ?
        h('div', { className: 'mt-panel mt-empty' }, h(Icon, { name: 'shield' }), h('h2', null, search ? 'نتیجه‌ای پیدا نشد' : 'هنوز رخدادی ثبت نشده'), h('p', null, search ? 'عبارت جستجو را تغییر دهید.' : 'تغییرات ثبت‌شده دفتر در این بخش نمایش داده می‌شوند.')) :
        h('ol', { className: 'mt-audit-list' }, filtered.slice((currentPage - 1) * 10, currentPage * 10).map(log => h('li', { className: 'mt-panel mt-audit-item', key: log.id },
          h('span', { className: 'mt-card-icon' }, h(Icon, { name: 'shield' })),
          h('div', { className: 'mt-audit-copy' }, h('h2', null, auditLabels[log.action] || log.title || 'تغییر در سامانه'), h('p', null, log.description && !log.description.includes(log.action) ? log.description : 'این تغییر در سابقه فعالیت دفتر ثبت شده است.')),
          h('time', { dateTime: log.created_at }, new Date(log.created_at).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' }))))),
      !state.loading && pages > 1 ? h('div', { className: 'mt-pagination', 'aria-label': 'صفحه‌بندی گزارش' },
        h('button', { type: 'button', className: 'mt-secondary', disabled: currentPage === 1, onClick: () => setPage(currentPage - 1) }, 'قبلی'),
        h('span', { 'aria-live': 'polite' }, `صفحه ${currentPage.toLocaleString('fa-IR')} از ${pages.toLocaleString('fa-IR')}`),
        h('button', { type: 'button', className: 'mt-secondary', disabled: currentPage === pages, onClick: () => setPage(currentPage + 1) }, 'بعدی')) : null);
  }
  return { Hub, Page, Settings, Security, Audit };
}
