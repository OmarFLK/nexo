import test from 'node:test';
import assert from 'node:assert/strict';
import {priceForProfit} from '../lib/price-for-profit.ts';
const costs={cost:10000,shipping:0,packaging:0,fixed:0};
const fees={commission:0,tax:0,reserve:0,payment:0};
test('compra por R$100 e lucro de R$50 exigem venda de R$150',()=>{const q=priceForProfit(costs,fees,5000);assert.equal(q.price,15000);assert.equal(q.netProfit,5000);});
test('comissão é incluída no preço para preservar o lucro em reais',()=>{const q=priceForProfit(costs,{...fees,commission:1000},5000);assert.equal(q.price,16667);assert.equal(q.commission,1667);assert.equal(q.netProfit,5000);});
test('frete, embalagem, custos e quatro taxas são deduzidos antes do lucro',()=>{const c={cost:10000,shipping:1200,packaging:350,fixed:200};const q=priceForProfit(c,{commission:1400,tax:600,reserve:200,payment:300},5000);assert.equal(q.totalCosts,11750);assert.ok(q.netProfit>=5000);assert.equal(q.price-q.totalCosts-q.commission-q.tax-q.reserve-q.payment,q.netProfit);assert.equal(q.afterFees,q.totalCosts+q.netProfit);});
test('lucro zero calcula preço sem prejuízo e custo zero aceita lucro desejado',()=>{assert.equal(priceForProfit(costs,fees,0).price,10000);assert.equal(priceForProfit({...costs,cost:0},fees,5000).price,5000);assert.equal(priceForProfit({...costs,cost:0},fees,0).price,0);});
test('centavos e arredondamento de taxas não retiram dinheiro do lucro pedido',()=>{const q=priceForProfit({cost:12345,shipping:1999,packaging:253,fixed:99},{commission:1375,tax:685,payment:234,reserve:157},3789);assert.ok(q.netProfit>=3789);assert.equal(q.netProfit,q.price-q.totalCosts-q.deductions);});
test('o resultado é o menor preço em centavos que atende ao lucro',()=>{
  const cases=[{commission:1250,tax:1250,reserve:1250,payment:1250},{commission:3333,tax:666,reserve:0,payment:234},{commission:0,tax:0,reserve:0,payment:0},{commission:875,tax:675,reserve:111,payment:123}];
  for(const f of cases)for(const [cost,goal] of [[1,1],[13,7],[100,50],[233,123]]){
    const q=priceForProfit({...costs,cost},f,goal);
    const actual=p=>p-cost-Object.values(f).reduce((n,r)=>n+Math.floor((p*r+5000)/10000),0);
    assert.ok(actual(q.price)>=goal);
    for(let price=0;price<q.price;price++)assert.ok(actual(price)<goal,`Preço menor possível: ${price} < ${q.price}`);
  }
});
test('taxas que somam 100% ou mais são inviáveis',()=>{assert.equal(priceForProfit(costs,{...fees,commission:6000,tax:4000},5000),null);assert.equal(priceForProfit(costs,{...fees,commission:10000,tax:100},5000),null);});
test('valores inválidos são rejeitados em vez de produzir NaN ou lucro incorreto',()=>{assert.throws(()=>priceForProfit(costs,fees,-1));assert.throws(()=>priceForProfit({...costs,cost:1.5},fees,100));assert.throws(()=>priceForProfit(costs,{...fees,tax:NaN},100));});
