/** Bound a UI prerequisite without turning failure into permission or an empty account. */
export async function withDeadline<T>(work:Promise<T>,ms=18000):Promise<T> {
  let timer:ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work,new Promise<never>((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Request deadline exceeded')),ms);
    })]);
  } finally { clearTimeout(timer); }
}
