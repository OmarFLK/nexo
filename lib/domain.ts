export class DomainError extends Error {}
export type Rules = { commission: number; tax: number; reserve: number; payment: number; target: number };
export type Product = { id: string; name: string; sku: string; category: string; brand: string; description: string; cost: number; price: number; shipping: number; packaging: number; fixed: number; stock: number; reserved: number; min: number; image: string; components: { productId: string; quantity: number }[]; channelPrices: Record<string, number>; costHistory: {cost:number;date:string;reason:string}[] };
export type Movement = { id: string; productId: string; quantity: number; reserved: number; type: string; reason: string; actor: string; date: string; balance: number };
export type Order = { id: string; productId: string; name: string; sku: string; quantity: number; price: number; cost: number; profit: number; rules: Rules; channel: string; customer: string; status: string; date: string; paidAt: string | null; items: { productId: string; quantity: number }[] };
export type Contact = { id: string; name: string; document: string; email: string; phone: string };
export type Purchase = { id: string; productId: string; supplier: string; quantity: number; cost: number; received: number; date: string; due: string };
export type Entry = { id: string; name: string; amount: number; type: string; due: string; settled: boolean; date: string };
export type Scenario = { id: string; name: string; rules: Rules };
export type State = { products: Product[]; movements: Movement[]; orders: Order[]; suppliers: Contact[]; customers: Contact[]; purchases: Purchase[]; entries: Entry[]; scenarios: Scenario[]; rules: Rules; applied: string[]; audit:{id:string;type:string;date:string;actor:string;details:Record<string,unknown>}[] };
export type Command = { id: string; type: string; payload: Record<string, unknown> };
const commandFields:Record<string,string[]>={product:['id','name','sku','category','brand','description','cost','price','shipping','packaging','fixed','min','initial','image','components'],stock:['productId','kind','quantity','reason'],price:['productId','price','channel'],rules:['rules'],scenario:['name','rules'],order:['productId','quantity','price','rules','channel','customer','paid','fulfilled'],completeOrder:['orderId'],orderStatus:['orderId','status'],supplier:['name','document','email','phone'],customer:['name','document','email','phone'],purchase:['productId','supplier','quantity','cost','due'],receive:['purchaseId','quantity'],entry:['name','kind','amount','due'],settle:['entryId']};
export function validateCommand(value:unknown):asserts value is Command{
  const command=value as Command;
  if(!command||typeof command.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(command.id)||typeof command.type!=='string'||!Object.hasOwn(commandFields,command.type)||!command.payload||typeof command.payload!=='object'||Array.isArray(command.payload))throw new DomainError('Comando inválido.');
  if(Object.keys(command.payload).some(key=>!commandFields[command.type].includes(key)))throw new DomainError('Campo não permitido na operação.');
  const inspect=(item:unknown,depth=0)=>{if(depth>5)throw new DomainError('Estrutura inválida.');if(item&&typeof item==='object'){if(Array.isArray(item)&&item.length>100)throw new DomainError('Lista muito grande.');for(const [key,entry] of Object.entries(item)){if(['__proto__','prototype','constructor'].includes(key))throw new DomainError('Campo inválido.');inspect(entry,depth+1);}}};inspect(command.payload);
}
function safeTotal(value:number){if(!Number.isSafeInteger(value))throw new DomainError('Valor total excede o limite seguro.');return value;}
function validDate(value:unknown){const text=str(value,'Vencimento');if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text+'T00:00:00Z'))||new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text)throw new DomainError('Data inválida.');return text;}
export const defaultRules: Rules = { commission: 0, tax: 0, reserve: 0, payment: 0, target: 2000 };
export function emptyState(): State { return { products: [], movements: [], orders: [], suppliers: [], customers: [], purchases: [], entries: [], scenarios: [], rules: { ...defaultRules }, applied: [],audit:[] }; }
function int(v: unknown, name: string, max = 100000000): number { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max) throw new DomainError(`${name}: valor inválido.`); return v; }
function str(v: unknown, name: string, optional = false, max = 300): string { if (v === undefined && optional) return ''; if (typeof v !== 'string' || v.length > max || (!optional && !v.trim())) throw new DomainError(`${name}: informe um valor válido.`); return v.trim(); }
export function validateRules(v: unknown): Rules { const r = v as Rules; if (!r || typeof r !== 'object') throw new DomainError('Taxas inválidas.'); return { commission: int(r.commission, 'Comissão', 10000), tax: int(r.tax, 'Tributos', 10000), reserve: int(r.reserve, 'Reserva', 10000), payment: int(r.payment, 'Pagamento', 10000), target: int(r.target, 'Margem', 9900) }; }
export function rate(cents: number, bps: number): number { return Number((BigInt(cents) * BigInt(bps) + BigInt(5000)) / BigInt(10000)); }
export function pricing(p: Pick<Product, 'cost' | 'price' | 'shipping' | 'packaging' | 'fixed'>, rules: Rules) {
  const deductions = rate(p.price, rules.commission) + rate(p.price, rules.tax) + rate(p.price, rules.reserve) + rate(p.price, rules.payment);
  const variable = p.shipping + p.packaging + p.fixed;
  const profit = p.price - deductions - p.cost - variable;
  const denominator = 10000 - rules.commission - rules.tax - rules.reserve - rules.payment;
  const recommend = (target: number) => {
    if (denominator - target <= 0) return null;
    let candidate = Number((BigInt(safeTotal(p.cost + variable)) * BigInt(10000) + BigInt(denominator - target - 1)) / BigInt(denominator - target));
    if(!Number.isSafeInteger(candidate)||candidate>1000000000000)return null;
    // A fórmula contínua precisa de ajuste pelo arredondamento individual de cada tarifa.
    for (let attempts=0;attempts<10000;attempts++) {
      const charges = rate(candidate,rules.commission)+rate(candidate,rules.tax)+rate(candidate,rules.reserve)+rate(candidate,rules.payment);
      if (BigInt(candidate - charges - p.cost - variable) * BigInt(10000) >= BigInt(candidate) * BigInt(target)) return candidate;
      candidate++;
    }
    return null;
  };
  return { profit, deductions, variable, margin: p.price ? profit / p.price * 100 : 0, markup: p.cost ? (p.price / p.cost - 1) * 100 : 0, roi: p.cost ? profit / p.cost * 100 : 0, breakEven: recommend(0), recommended: recommend(rules.target) };
}
export function available(p: Product, state: State): number { return p.components.length ? Math.min(...p.components.map(c => { const component = state.products.find(x => x.id === c.productId); return component ? Math.floor((component.stock - component.reserved) / c.quantity) : 0; })) : p.stock - p.reserved; }
export function applyCommand(source: State, command: Command, actor: string, now = new Date().toISOString()): State {
  validateCommand(command);
  str(command.id, 'Identificador'); if (source.applied.includes(command.id)) return source;
  const s: State = structuredClone(source); const d = command.payload;
  const find = (id: unknown) => { const p = s.products.find(x => x.id === id); if (!p) throw new DomainError('Produto não encontrado.'); return p; };
  const move = (p: Product, quantity: number, reserved: number, type: string, reason: string) => {
    if (p.components.length) throw new DomainError('Movimente os componentes do kit.');
    if (p.stock + quantity < 0 || p.reserved + reserved < 0 || p.stock + quantity < p.reserved + reserved) throw new DomainError(`Saldo insuficiente: ${p.name}.`);
    p.stock += quantity; p.reserved += reserved;
    if(!Number.isSafeInteger(p.stock)||!Number.isSafeInteger(p.reserved)||p.stock>1000000000)throw new DomainError('Saldo excede o limite permitido.');
    s.movements.unshift({ id: `${command.id}-${s.movements.length}`, productId: p.id, quantity, reserved, type, reason, actor, date: now, balance: p.stock });
  };
  switch (command.type) {
    case 'product': {
      if(d.components!==undefined&&!Array.isArray(d.components))throw new DomainError('Composição de kit inválida.');
      const old = d.id ? find(d.id) : null;
      const sku = str(d.sku, 'SKU', false, 80);
      if (s.products.some(x => x.sku.toLowerCase() === sku.toLowerCase() && x.id !== old?.id)) throw new DomainError('Já existe um produto com esse SKU.');
      const components = Array.isArray(d.components) ? d.components.map((c: { productId: string; quantity: number }) => { if(!c||typeof c!=='object')throw new DomainError('Composição de kit inválida.');const p = find(c.productId); if (p.id === old?.id || p.components.length || old?.stock || old?.reserved) throw new DomainError('Composição de kit inválida.'); const quantity = int(c.quantity, 'Quantidade', 10000); if (!quantity) throw new DomainError('Quantidade deve ser positiva.'); return { productId: p.id, quantity }; }) : [];
      if (new Set(components.map(c => c.productId)).size !== components.length) throw new DomainError('Componente duplicado.');
      if (old && Boolean(old.components.length) !== Boolean(components.length) && s.orders.some(o => o.productId === old.id)) throw new DomainError('Crie um novo SKU para mudar o tipo de produto após vendas.');
      const image = str(d.image, 'Imagem', true, 1000); if (image && !image.startsWith('/api/upload?key=')) throw new DomainError('Imagem inválida.');
      const product: Product = { id: old?.id ?? command.id, name: str(d.name, 'Nome'), sku, category: str(d.category, 'Categoria', true), brand: str(d.brand, 'Marca', true), description: str(d.description, 'Descrição', true, 3000), cost: int(d.cost, 'Custo'), price: int(d.price, 'Preço'), shipping: int(d.shipping ?? 0, 'Frete'), packaging: int(d.packaging ?? 0, 'Embalagem'), fixed: int(d.fixed ?? 0, 'Outros custos'), min: int(d.min ?? 5, 'Estoque mínimo', 100000), stock: old?.stock ?? 0, reserved: old?.reserved ?? 0, image, components, channelPrices: old?.channelPrices ?? {},costHistory: old?.costHistory ?? [] };
      if (old) s.products[s.products.indexOf(old)] = product; else s.products.push(product);
      const initial = int(d.initial ?? 0, 'Estoque inicial', 1000000); if (!old && initial) move(product, initial, 0, 'Entrada inicial', 'Cadastro do produto');
      break;
    }
    case 'stock': {
      const p = find(d.productId); const n = int(d.quantity, 'Quantidade', 1000000); const reason = str(d.reason, 'Motivo');
      if (!['in', 'out', 'count', 'loss', 'return'].includes(String(d.kind))) throw new DomainError('Tipo de movimento inválido.');
      const delta = d.kind === 'count' ? n - p.stock : ['out', 'loss'].includes(String(d.kind)) ? -n : n;
      if (!delta) throw new DomainError('A quantidade não altera o estoque.');
      move(p, delta, 0, ({ in: 'Entrada', out: 'Saída', count: 'Inventário', loss: 'Perda / avaria', return: 'Devolução' } as Record<string,string>)[String(d.kind)], reason); break;
    }
    case 'rules': s.rules = validateRules(d.rules); break;
    case 'scenario': s.scenarios.push({ id: command.id, name: str(d.name, 'Nome do cenário'), rules: validateRules(d.rules) }); break;
    case 'price': { const p = find(d.productId); const price = int(d.price, 'Preço'); const channel = str(d.channel, 'Canal');if(['__proto__','constructor','prototype'].includes(channel))throw new DomainError('Canal inválido.'); if (channel === 'Padrão') p.price = price; else p.channelPrices[channel] = price; break; }
    case 'order': {
      if((d.paid!==undefined&&typeof d.paid!=='boolean')||(d.fulfilled!==undefined&&typeof d.fulfilled!=='boolean'))throw new DomainError('Confirmação de venda inválida.');
      const p = find(d.productId); const quantity = int(d.quantity, 'Quantidade', 10000); if (!quantity) throw new DomainError('Informe uma quantidade positiva.');
      if (available(p, s) < quantity) throw new DomainError('Estoque disponível insuficiente.');
      const price = int(d.price, 'Preço'); const rules = validateRules(d.rules ?? s.rules); const channel = str(d.channel, 'Canal');
      const items = p.components.length ? p.components.map(c => ({ productId: c.productId, quantity: c.quantity * quantity })) : [{ productId: p.id, quantity }];
      const cost = p.components.length ? p.components.reduce((n,c) => n + find(c.productId).cost * c.quantity, 0) : p.cost;
      if(d.fulfilled===true&&d.paid!==true)throw new DomainError('Confirme o pagamento antes de concluir a venda.');
      const order: Order = { id: command.id, productId: p.id, name: p.name, sku: p.sku, quantity, price, cost, rules: { ...rules }, profit: pricing({ ...p, cost, price }, rules).profit * quantity, channel, customer: str(d.customer, 'Cliente', true), status: d.fulfilled===true?'Entregue':d.paid === true ? 'Pago' : 'Pendente', date: now, paidAt: d.paid === true ? now : null, items };
      safeTotal(order.profit);safeTotal(order.price*quantity);safeTotal(cost*quantity);
      for (const item of items) {
        if(d.fulfilled===true)move(find(item.productId),-item.quantity,0,'Venda',`Venda ${order.id.slice(0,8)}`);
        else move(find(item.productId), 0, item.quantity, 'Reserva', `Pedido ${order.id.slice(0,8)}`);
      }
      s.orders.unshift(order); break;
    }
    case 'completeOrder': {
      const order=s.orders.find(o=>o.id===d.orderId);if(!order||!['Pendente','Pago'].includes(order.status))throw new DomainError('Essa venda não pode ser concluída.');
      for(const item of order.items)move(find(item.productId),-item.quantity,-item.quantity,'Venda',`Venda ${order.id.slice(0,8)}`);
      order.status='Entregue';order.paidAt??=now;break;
    }
    case 'orderStatus': {
      const o = s.orders.find(x => x.id === d.orderId); if (!o) throw new DomainError('Pedido não encontrado.');
      const next = str(d.status, 'Status');
      const allowed: Record<string,string[]> = { Pendente: ['Pago','Cancelado'], Pago: ['Enviado','Cancelado'], Enviado: ['Entregue','Devolvido'], Entregue: ['Devolvido'] };
      if (!allowed[o.status]?.includes(next)) throw new DomainError('Transição de pedido inválida.');
      for (const item of o.items) {
        const p = find(item.productId);
        if (next === 'Cancelado') move(p, 0, -item.quantity, 'Liberação', `Cancelamento ${o.id.slice(0,8)}`);
        if (next === 'Enviado') move(p, -item.quantity, -item.quantity, 'Venda', `Envio ${o.id.slice(0,8)}`);
        if (next === 'Devolvido') move(p, item.quantity, 0, 'Devolução', `Devolução ${o.id.slice(0,8)}`);
      }
      if (next === 'Pago') o.paidAt = now; o.status = next; break;
    }
    case 'supplier': case 'customer': {
      const contact: Contact = { id: command.id, name: str(d.name, 'Nome'), document: str(d.document, 'Documento', true), email: str(d.email, 'E-mail', true), phone: str(d.phone, 'Telefone', true) };
      (command.type === 'supplier' ? s.suppliers : s.customers).push(contact); break;
    }
    case 'purchase': {
      const p = find(d.productId); if (p.components.length) throw new DomainError('Compre os componentes do kit.'); const quantity = int(d.quantity, 'Quantidade', 1000000); if (!quantity) throw new DomainError('Quantidade deve ser positiva.');
      const cost = int(d.cost, 'Custo'); const supplier = str(d.supplier, 'Fornecedor'); if (!s.suppliers.some(x => x.id === supplier)) throw new DomainError('Fornecedor não encontrado.');
      const due = validDate(d.due);safeTotal(cost*quantity);
      s.purchases.unshift({ id: command.id, productId: p.id, supplier, quantity, cost, received: 0, date: now, due });
      s.entries.unshift({ id: `${command.id}-pay`, name: `Compra: ${p.name}`, amount: cost * quantity, type: 'expense', due, settled: false, date: now }); break;
    }
    case 'receive': {
      const buy = s.purchases.find(x => x.id === d.purchaseId); if (!buy) throw new DomainError('Compra não encontrada.');
      const quantity = int(d.quantity, 'Quantidade', buy.quantity - buy.received); if (!quantity) throw new DomainError('Quantidade deve ser positiva.'); const p = find(buy.productId);
      p.cost = Number((BigInt(p.stock * p.cost + quantity * buy.cost) + BigInt(Math.floor((p.stock + quantity)/2))) / BigInt(p.stock + quantity));
      move(p, quantity, 0, 'Compra', `Recebimento ${buy.id.slice(0,8)}`); buy.received += quantity; break;
    }
    case 'entry': {
      const due = validDate(d.due); if (!['expense','income'].includes(String(d.kind))) throw new DomainError('Tipo inválido.');
      s.entries.unshift({ id: command.id, name: str(d.name, 'Descrição'), amount: int(d.amount, 'Valor'), type: String(d.kind), due, settled: false, date: now }); break;
    }
    case 'settle': { const e = s.entries.find(x => x.id === d.entryId); if (!e) throw new DomainError('Lançamento não encontrado.'); if (e.settled) throw new DomainError('Lançamento já liquidado.'); e.settled = true; break; }
    default: throw new DomainError('Operação desconhecida.');
  }
  const details = Object.fromEntries(Object.entries(d).filter(([key])=>!['image','description'].includes(key)));
  s.audit??=[];s.audit.unshift({id:command.id,type:command.type,date:now,actor,details});
  for (const p of s.products) {
    const previous=source.products.find(x=>x.id===p.id);p.costHistory??=[];
    if (!previous || previous.cost!==p.cost) p.costHistory.unshift({cost:p.cost,date:now,reason:command.type==='receive'?'Custo médio após recebimento':previous?'Alteração de cadastro':'Custo inicial'});
  }
  s.applied.push(command.id); return s;
}
