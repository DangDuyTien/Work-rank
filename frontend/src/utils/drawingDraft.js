// Local recovery only. Published artwork always comes from API + persistent storage.
const NAME='workrank-drawing-drafts-v1';
async function withStore(userId,operation,value){
  if(!globalThis.indexedDB)throw new Error('Thiết bị không hỗ trợ lưu nháp.');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts',operation==='get'?'readonly':'readwrite'),store=tx.objectStore('drafts');
    const request=operation==='get'?store.get(String(userId)):operation==='delete'?store.delete(String(userId)):store.put(value,String(userId));let result;
    request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(tx.error||new Error('Không lưu được nháp.'));tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
export const loadDrawingDraft=userId=>withStore(userId,'get');
export const saveDrawingDraft=(userId,value)=>withStore(userId,'put',value);
export const removeDrawingDraft=userId=>withStore(userId,'delete');
