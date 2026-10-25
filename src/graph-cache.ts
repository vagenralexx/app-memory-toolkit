/** Cache derived results only after adapters read and validate current sources. No filesystem shortcuts. */
import{createHash}from'node:crypto';import type{GraphInput}from'./graph-core.js';import{queryGraph}from'./graph-core.js';
const cache=new Map<string,{serialized:string;bytes:number}>();let bytes=0;
export function cachedGraphQuery(input:GraphInput,args:Record<string,unknown>){const key=createHash('sha256').update(JSON.stringify([input,args])).digest('hex'),old=cache.get(key);if(old){cache.delete(key);cache.set(key,old);return{...JSON.parse(old.serialized),derived_cache:{hit:true,storage:'bounded_process_memory_after_fresh_source_validation'}};}
 const result=queryGraph(input,args),serialized=JSON.stringify(result),size=Buffer.byteLength(serialized);if(size<=1000000){while(cache.size>=12||bytes+size>6000000){const first=cache.keys().next().value;if(!first)break;bytes-=cache.get(first)!.bytes;cache.delete(first);}cache.set(key,{serialized,bytes:size});bytes+=size;}
 return{...result,derived_cache:{hit:false,storage:'bounded_process_memory_after_fresh_source_validation'}};
}
