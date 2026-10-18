'use client';
import {useState,useEffect} from 'react';
import {RotateCcw,Save} from 'lucide-react';
import {defaultRules,type State,type Rules} from '../lib/domain';
import {priceForProfit} from '../lib/price-for-profit';
import {Field,money,toCents} from './ui';

type Draft={name:string;cost:string;profit:string;shipping:string;packaging:string;fixed:string;rules:Rules;productId:string};
const fresh=():Draft=>({name:'',cost:'',profit:'',shipping:'',packaging:'',fixed:'',rules:{...defaultRules},productId:''});
// Só memória: preserva ao trocar de tela e limpa ao recarregar o aplicativo.
let cachedDraft:Draft|null=null;
export default function Pricing({state,run,busy}:{state:State;run:(type:string,payload:Record<string,unknown>)=>Promise<boolean>;busy:boolean}){
  const [draft,setDraft]=useState<Draft>(()=>cachedDraft??fresh());
  useEffect(()=>{cachedDraft=draft;},[draft]);
  const change=(key:'cost'|'profit'|'shipping'|'packaging'|'fixed',value:string)=>setDraft(d=>({...d,[key]:value}));
  const updateFee=(key:keyof Rules,input:string)=>{try{const value=toCents(input);if(value<=10000)setDraft(d=>({...d,rules:{...d.rules,[key]:value}}));}catch{/* Mantém a última taxa válida. */}};
  const selected=state.products.find(p=>p.id===draft.productId);
  const complete=draft.cost.trim()!==''&&draft.profit.trim()!=='';
  let quote:ReturnType<typeof priceForProfit>=null;let error='';
  try{
    const costs={cost:toCents(draft.cost),shipping:toCents(draft.shipping),packaging:toCents(draft.packaging),fixed:toCents(draft.fixed)};
    const desired=toCents(draft.profit);
    if(complete){quote=priceForProfit(costs,draft.rules,desired);if(!quote)error='As taxas somam 100% ou mais. Reduza as taxas para calcular o preço.';}
  }catch(e){error=(e as Error).message;}
  function load(id:string){
    const product=state.products.find(p=>p.id===id);
    if(!product){setDraft(d=>({...d,productId:''}));return;}
    const cost=product.components.length?product.components.reduce((total,c)=>total+(state.products.find(p=>p.id===c.productId)?.cost??0)*c.quantity,0):product.cost;
    setDraft(d=>({...d,name:product.name,cost:(cost/100).toFixed(2),shipping:(product.shipping/100).toFixed(2),packaging:(product.packaging/100).toFixed(2),fixed:(product.fixed/100).toFixed(2),rules:{...state.rules},productId:id}));
  }
  const output=quote?money(quote.price):'—';
  const margin=quote&&quote.price>0?new Intl.NumberFormat('pt-BR',{style:'percent',minimumFractionDigits:2,maximumFractionDigits:2}).format(quote.netProfit/quote.price):'—';
  return <div className="pricing-page goal-pricing">
    <section className={'recommendation sale-banner '+(!quote?'waiting-quote':'')} aria-label="Resultado da precificação" aria-live="polite">
      <div className="banner-price"><h2>Venda por</h2><strong>{output}</strong><p>{quote?(draft.name||'Preço por peça'):'Informe o custo e o lucro desejado'}</p></div>
      <div className="banner-profit goal-confirmation"><span>Lucro por peça</span><strong>{quote?money(quote.netProfit):'—'}</strong></div>
      <div className="banner-margin"><span>Margem de lucro</span><strong>{margin}</strong><small>Lucro ÷ preço de venda</small></div>
      {selected&&quote&&<div className="banner-actions"><button className="button dark" disabled={busy||quote.price>100000000} onClick={()=>run('price',{productId:selected.id,price:quote.price,channel:'Padrão'})}><Save size={17}/>{busy?'Salvando...':'Salvar preço no estoque'}</button><span>Aplica só o preço de venda em {selected.name}.</span></div>}
    </section>
    {error&&<p className="error-message pricing-error" role="alert">{error}</p>}
    <section className="panel simulation">
      <div className="section-heading"><h2>Quanto preciso cobrar?</h2><button className="text-button" onClick={()=>setDraft(fresh())}><RotateCcw size={16}/>Limpar</button></div>
      <p className="section-note">Informe quanto vai pagar e quanto quer ganhar em cada peça.</p>
      <Field label="Qual é a peça?"><input aria-label="Nome da peça" placeholder="Nome do produto (opcional)" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value,productId:''}))}/></Field>
      <div className="goal-step"><span className="step-number">1</span><Field label="Quanto vou pagar na peça"><div className="amount"><span>R$</span><input aria-label="Custo de compra" inputMode="decimal" placeholder="0,00" value={draft.cost} onChange={e=>change('cost',e.target.value)}/></div></Field></div>
      <div className="goal-step profit-goal"><span className="step-number">2</span><Field label="Quanto quero lucrar por peça"><div className="amount"><span>R$</span><input aria-label="Lucro desejado" inputMode="decimal" placeholder="0,00" value={draft.profit} onChange={e=>change('profit',e.target.value)}/></div><small>O valor que deve sobrar depois da compra, das taxas e das despesas informadas.</small></Field></div>
      <details className="form-details pricing-expenses"><summary>Tenho taxas ou despesas na venda</summary>
        <p className="small-note">Se não houver, deixe zero. As taxas abaixo incidem sobre o preço de venda.</p>
        <div className="form-grid">{([['commission','Comissão (%)'],['tax','Impostos (%)'],['payment','Taxa de pagamento (%)'],['reserve','Reserva para perdas (%)']] as const).map(([key,label])=><Field label={label} key={key}><div className="percent-input"><input aria-label={label} inputMode="decimal" type="number" min="0" max="100" step="0.01" value={draft.rules[key]/100} onChange={e=>updateFee(key,e.target.value)}/><span>%</span></div></Field>)}</div>
        <div className="form-grid">{([['shipping','Frete pago por mim'],['packaging','Embalagem'],['fixed','Outros custos por peça']] as const).map(([key,label])=><Field key={key} label={label}><div className="amount"><span>R$</span><input aria-label={label} inputMode="decimal" placeholder="0,00" value={draft[key]} onChange={e=>change(key,e.target.value)}/></div></Field>)}</div>
      </details>
      <details className="optional-stock"><summary>Puxar uma peça do estoque (opcional)</summary><Field label="Produto cadastrado"><select aria-label="Carregar produto do estoque" value={draft.productId} onChange={e=>load(e.target.value)}><option value="">Digitar uma peça livremente</option>{state.products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></Field><p className="small-note">Carrega o custo do cadastro. Você pode alterar os valores para simular uma nova compra.</p></details>
    </section>
    <div className="simulation-output" aria-live="polite">
      {quote&&<section className="panel result"><div className="section-heading"><h2>Para onde vai o dinheiro</h2></div><div className="calculation goal-breakdown"><div><span>Preço de venda</span><strong>{money(quote.price)}</strong></div><div><span>Compra da peça</span><strong>− {money(quote.cost)}</strong></div>{quote.shipping>0&&<div><span>Frete pago por você</span><strong>− {money(quote.shipping)}</strong></div>}{quote.packaging>0&&<div><span>Embalagem</span><strong>− {money(quote.packaging)}</strong></div>}{quote.fixed>0&&<div><span>Outros custos</span><strong>− {money(quote.fixed)}</strong></div>}{quote.commission>0&&<div><span>Comissão ({draft.rules.commission/100}%)</span><strong>− {money(quote.commission)}</strong></div>}{quote.tax>0&&<div><span>Impostos ({draft.rules.tax/100}%)</span><strong>− {money(quote.tax)}</strong></div>}{quote.payment>0&&<div><span>Pagamento ({draft.rules.payment/100}%)</span><strong>− {money(quote.payment)}</strong></div>}{quote.reserve>0&&<div><span>Reserva para perdas ({draft.rules.reserve/100}%)</span><strong>− {money(quote.reserve)}</strong></div>}<div className="goal-total"><span>Seu lucro por peça</span><strong>{money(quote.netProfit)}</strong></div></div></section>}
      {quote&&quote.deductions>0&&<p className="small-note">O preço já cobre as taxas informadas, para preservar seu lucro em reais.</p>}
    </div>
  </div>;
}
