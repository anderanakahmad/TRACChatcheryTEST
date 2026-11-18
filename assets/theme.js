const STORAGE_KEY='tracc_theme';
export function themePreference(){
  try{const stored=localStorage.getItem(STORAGE_KEY);if(stored==='dark'||stored==='light')return stored;}catch{}
  try{return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch{return 'light';}
}
export function initThemeToggle(id='themeSwitch'){
  const root=globalThis.document?.documentElement,button=globalThis.document?.getElementById(id);
  if(!root||!button)return;
  const update=theme=>{
    root.dataset.theme=theme;
    button.setAttribute('aria-pressed',String(theme==='dark'));
    button.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');
    button.querySelector('.theme-switch-icon').textContent=theme==='dark'?'☀':'☾';
    button.querySelector('.theme-switch-label').textContent=theme==='dark'?'Light':'Dark';
    const meta=globalThis.document?.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='dark'?'#0b2027':'#062f39');
  };
  update(root.dataset.theme==='dark'?'dark':'light');
  button.addEventListener('click',()=>{
    const theme=root.dataset.theme==='dark'?'light':'dark';
    try{localStorage.setItem(STORAGE_KEY,theme);}catch{}
    update(theme);
  });
}
