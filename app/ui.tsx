'use client';
import type {ReactNode} from 'react';
import {Package} from 'lucide-react';
export const money=(value:number|null)=>value===null?'Inviável':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value/100);
export const shortDate=(value:string)=>new Date(value.length===10?value+'T12:00:00':value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'});
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
export function toCents(value:unknown){
  const text=String(value??'').trim().replace(',','.');
  if(!/^\d*(\.\d{0,2})?$/.test(text))throw Error('Informe um valor positivo com até duas casas decimais.');
  const [whole,fraction='']=text.split('.');const result=Number(whole||0)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(result)||result>100000000)throw Error('Valor máximo: R$ 1.000.000,00.');return result;
}
export function Field({label,children,wide=false}:{label:string;children:ReactNode;wide?:boolean}){return <label className={'field'+(wide?' wide':'')}><span>{label}</span>{children}</label>;}
export function Amount({name,value=0,required=false}:{name:string;value?:number;required?:boolean}){return <div className="amount"><span>R$</span><input name={name} type="number" inputMode="decimal" step="0.01" min="0" max="1000000" defaultValue={(value/100).toFixed(2)} required={required}/></div>;}
export function Status({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={'status '+tone}>{children}</span>;}
export function Empty({title,text,action}:{title:string;text?:string;action?:ReactNode}){return <div className="empty"><Package size={30}/><h2>{title}</h2>{text&&<p>{text}</p>}{action}</div>;}
export function Metric({label,value}:{label:string;value:ReactNode}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;}
