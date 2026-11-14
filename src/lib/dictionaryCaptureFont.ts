let embedded: Promise<string> | undefined;

/** Load once, only when the dictionary is mounted. No cross-origin stylesheet inspection. */
export function dictionaryCaptureFont() {
  if (!embedded) embedded = fetch('/fonts/pretendard/PretendardVariable.woff2')
    .then(response => { if (!response.ok) throw new Error('Dictionary font unavailable'); return response.blob(); })
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(new Error('Dictionary font unreadable'));
      reader.onload = () => resolve(`@font-face{font-family:'Pretendard Variable';font-style:normal;font-weight:45 920;src:url('${reader.result}') format('woff2');}`);
      reader.readAsDataURL(blob);
    })).catch(error => { embedded = undefined; throw error; });
  return embedded;
}
