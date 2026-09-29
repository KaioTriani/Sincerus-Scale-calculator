'use client';
import { useEffect, useRef } from 'react';
import type { Simulation } from '@/lib/simulation';

type ModelContext = { registerTool: (tool: {name:string;title:string;description:string;inputSchema:object;annotations:object;execute:(input:unknown)=>unknown}, options:{signal:AbortSignal})=>void|Promise<void> };
export function useSimulationTool(simulation: Simulation | null, error: string) {
  const current=useRef({simulation,error});
  useEffect(()=>{current.current={simulation,error};},[simulation,error]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?:ModelContext}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const tool={name:'read_current_iphone_projection',title:'Ler projeção atual',description:'Lê os três cenários e alertas atualmente exibidos no simulador. Não altera dados e não gira a roleta.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input:unknown){
      if(input===null||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Informe um objeto vazio.');
      const value=current.current;
      if(!value.simulation)throw new Error(value.error||'Simulação inválida.');
      return JSON.parse(JSON.stringify(value.simulation));
    }};
    try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Navegadores sem implementação completa preservam a interface. */}
    return ()=>lifecycle.abort();
  },[]);
}
