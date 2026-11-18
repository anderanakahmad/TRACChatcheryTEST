/* Set user-selected/system theme before styles load to avoid flashing light mode. */
(function(){
  let mode='light';
  try {const saved=localStorage.getItem('tracc_theme');
    mode=saved==='dark'||saved==='light'?saved:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  }catch{}
  document.documentElement.dataset.theme=mode;
})();
