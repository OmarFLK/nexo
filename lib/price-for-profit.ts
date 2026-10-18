// Dinheiro em centavos e taxas em pontos-base. Não depende do estoque.
export type PurchaseCosts={cost:number;shipping:number;packaging:number;fixed:number};
export type SaleFees={commission:number;tax:number;reserve:number;payment:number};
const base=10000n;
const roundedFee=(price:bigint,bps:number)=>(price*BigInt(bps)+5000n)/base;
function integer(value:number,label:string,max:number){if(!Number.isSafeInteger(value)||value<0||value>max)throw Error(`${label}: informe um valor válido.`);return value;}

export function priceForProfit(costs:PurchaseCosts,fees:SaleFees,desiredProfit:number){
  const cost=integer(costs.cost,'Custo',100000000);
  const shipping=integer(costs.shipping,'Frete',100000000);
  const packaging=integer(costs.packaging,'Embalagem',100000000);
  const fixed=integer(costs.fixed,'Outros custos',100000000);
  integer(desiredProfit,'Lucro desejado',100000000);
  const rates=[fees.commission,fees.tax,fees.reserve,fees.payment].map(value=>integer(value,'Taxa',10000));
  const totalRate=rates.reduce((total,value)=>total+value,0);
  if(totalRate>=10000)return null;
  const totalCosts=cost+shipping+packaging+fixed;
  const required=BigInt(totalCosts+desiredProfit);
  const denominator=base-BigInt(totalRate);
  // O arredondamento de cada taxa pode reduzir seu custo em até meio centavo.
  // Partir deste limite inferior e conferir cada centavo encontra o primeiro
  // preço que entrega o lucro pedido, mesmo quando várias taxas arredondam juntas.
  const lower=required*base-BigInt(rates.filter(Boolean).length)*5000n;
  let candidate=lower<=0n?0n:(lower+denominator-1n)/denominator;
  let charges:bigint[];
  for(;;){
    charges=rates.map(rate=>roundedFee(candidate,rate));
    const deduction=charges.reduce((total,value)=>total+value,0n);
    if(candidate-deduction>=required)break;
    candidate++;
  }
  const [commission,tax,reserve,payment]=charges.map(Number);
  const deductions=commission+tax+reserve+payment;
  const price=Number(candidate);
  const netProfit=price-deductions-totalCosts;
  return {price,netProfit,desiredProfit,totalCosts,cost,shipping,packaging,fixed,commission,tax,reserve,payment,deductions,afterFees:price-deductions};
}
