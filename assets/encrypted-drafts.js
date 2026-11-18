/** Encrypted, opt-in *device-only* drafts. Never stores a passphrase or plaintext. */
const KEY='tracc_hatchery_v5_encrypted_draft';
const encoder=new TextEncoder(),decoder=new TextDecoder();
const base64=arr=>btoa(String.fromCharCode(...arr));
const unbase64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(passphrase,salt){
  if(!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues)throw Error('Encrypted drafts require HTTPS or localhost in a modern browser.');
  const base=await globalThis.crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
  return globalThis.crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function saveEncryptedDraft(document,passphrase,accountId='local'){
  if(passphrase.length<12)throw Error('Use a draft passphrase of at least 12 characters. It is not stored or recoverable.');
  const salt=globalThis.crypto.getRandomValues(new Uint8Array(16)),iv=globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key=await derive(passphrase,salt);
  const plain=encoder.encode(JSON.stringify({accountId,document}));
  const ciphertext=new Uint8Array(await globalThis.crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain));
  localStorage.setItem(KEY,JSON.stringify({version:1,salt:base64(salt),iv:base64(iv),ciphertext:base64(ciphertext)}));
}
export async function readEncryptedDraft(passphrase,accountId='local'){
  const raw=localStorage.getItem(KEY);if(!raw)throw Error('No encrypted draft is saved on this device.');
  const item=JSON.parse(raw);if(item.version!==1)throw Error('Unknown encrypted draft version.');
  try {
    const key=await derive(passphrase,unbase64(item.salt));
    const decrypted=await globalThis.crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(item.iv)},key,unbase64(item.ciphertext));
    const {accountId:saved,document}=JSON.parse(decoder.decode(decrypted));
    if(saved!==accountId)throw Error('This draft belongs to a different staff account.');
    return document;
  }catch(e){throw Error(e.message.includes('different staff')?e.message:'Unable to decrypt this draft. Check your passphrase.');}
}
export const hasEncryptedDraft=()=>Boolean(localStorage.getItem(KEY));
export const clearEncryptedDraft=()=>localStorage.removeItem(KEY);
