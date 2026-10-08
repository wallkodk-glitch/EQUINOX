import { describe, expect, it } from 'vitest';
import { allocate, execute } from '../src/execution/allocator';
import { erc, ercObjective } from '../src/optimization/targets';
import { diagnose } from '../src/risk/math';

describe('critical adversarial audit', () => {
  it('continuous L2 satisfies independent active-set KKT on bounded portfolios', () => {
    let seed = 1827;
    const rnd = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let k = 0; k < 1000; k++) {
      const v = Array.from({length:5}, () => Math.floor(rnd() * 1e7));
      const c = k % 10 === 0 ? 0 : 0.01 + rnd() * 1e6;
      const raw = Array.from({length:5}, () => rnd());
      const total = raw.reduce((a,b)=>a+b,0), t = raw.map(x=>x/total);
      const b = allocate(v,c,t), den = v.reduce((a,b)=>a+b,0) + c;
      expect(b.every(x=>x>=0)).toBe(true);
      expect(Math.abs(b.reduce((a,b)=>a+b,0)-c)).toBeLessThan(1e-7);
      if (c===0) continue;
      const error = b.map((x,i)=>v[i]+x-t[i]*den);
      const active = error.filter((_,i)=>b[i]>0);
      expect(Math.max(...active)-Math.min(...active)).toBeLessThan(1e-7);
      error.forEach((x,i)=> { if (b[i]===0) expect(x+1e-7).toBeGreaterThanOrEqual(active[0]); });
    }
  });
  it('ERC accepted objective holds on the original covariance, or fails closed on near hedges', () => {
    const accepted: unknown[] = [];
    for (const k of [0.17, 0.3, 0.7, 1.1, 2, 3.7]) for (const eps of [0.1,0.01,1e-4,1e-7,1e-9,1e-11]) {
      const s = [[1,-k*(1-eps)],[-k*(1-eps),k*k]];
      if (!diagnose(s).stable) continue;
      let out;
      try { out = erc(s); } catch (error) { expect(String(error)).toContain('ERC_NO_CONVERGENCE'); continue; }
      const objective = ercObjective(out.weights,s);
      accepted.push({k,eps,reported:out.solver.objective,objective});
      expect(objective, JSON.stringify(accepted.at(-1))).toBeLessThanOrEqual(out.solver.tolerance);
    }
    expect(accepted.length).toBeGreaterThan(0);
  });
  it('minimum-order discrete greedy matches independent literal integer-cent oracle', () => {
    let seed = 29;
    const rnd = (n:number) => { seed=(1664525*seed+1013904223)>>>0; return seed%n; };
    for (let run=0;run<500;run++) {
      const v=Array.from({length:5},()=>rnd(200));
      const cash=1+rnd(50000), c=cash/100;
      const targets=Array.from({length:5},()=>1+rnd(100));
      const t=targets.map(x=>x/targets.reduce((a,b)=>a+b,0));
      const cents=Array.from({length:5},()=>1+rnd(1000));
      const min=Array.from({length:5},()=>rnd(10000));
      const inc=[1,0.001,1,0.01,0.0001];
      const prices=cents.map((x,i)=>x/100/inc[i]);
      const b=allocate(v,c,t);
      const counts=b.map((x,i)=>Math.floor(x*100/cents[i]));
      const minimum=min.map((x,i)=>Math.max(1,Math.ceil(x/cents[i])));
      counts.forEach((x,i)=>{if(x<minimum[i])counts[i]=0;});
      let remaining=cash-counts.reduce((a,x,i)=>a+x*cents[i],0);
      for(let iter=0;iter<50000;iter++) {
        let best=-1, gain=-Infinity, jump=0;
        for(let i=0;i<5;i++) {
          const j=counts[i]===0?minimum[i]:1, cost=j*cents[i];
          if(cost>remaining)continue;
          const step=cost/100;
          const gap=t[i]*(v.reduce((a,b)=>a+b,0)+c)-v[i]-counts[i]*cents[i]/100;
          const improvement=2*gap*step-step*step;
          if(improvement>gain){best=i;gain=improvement;jump=j;}
        }
        if(best<0)break;
        counts[best]+=jump;remaining-=jump*cents[best];
      }
      const e=execute(v,c,t,b,prices,inc.map((increment,i)=>({increment,minimumDKK:min[i]/100})));
      expect(e.orders.map(x=>Number(x.increments)),JSON.stringify({run,v,c,t,prices,min,inc})).toEqual(counts);
      expect(e.residual).toBe(remaining/100);
      expect(Math.abs(e.orders.reduce((s,o)=>s+o.buy+o.fee,0)+e.residual-c)).toBeLessThan(1e-8);
    }
  });
});

import { prepareRisk } from '../src/market-data/provider';
import { demoDataset } from '../src/market-data/demo';
import { constrainedTarget, defaultPolicy } from '../src/optimization/targets';
const auditTime = '2026-10-02T06:00:00.000Z';
it('rejects contradictory rates for the same published FX observation', () => {
  const data = demoDataset(auditTime);
  const older = data.rows[data.rows.length - 2];
  const latest = data.rows[data.rows.length - 1];
  latest.fx = { ...older.fx, rate: older.fx.rate * 1.10 };
  expect(() => prepareRisk(data, auditTime, 504)).toThrow('FX_OBSERVATION_CONFLICT');
});
it('rejects acquisition before observations existed', () => {
  const data = demoDataset(auditTime);
  data.acquiredAt = data.rows[0].closeAt;
  expect(() => prepareRisk(data, auditTime, 504)).toThrow('DATA_ACQUISITION_BEFORE_OBSERVATION');
});
it('constrained ERC accepted solution resists independent feasible transfers', () => {
  const cases = [
    [0.001,0.02,0.8,0.5,0.9], [1,1,1,1,1], [0.8,0.1,0.2,0.0001,0.4],
  ];
  for(const d of cases) {
    const s = d.map((v,i)=>d.map((w,j)=>i===j?v:0.05*Math.sqrt(v*w)));
    const p = defaultPolicy(); p.upper[0]=0.25; p.cryptoCap=0.1;
    const out=constrainedTarget('erc',s,erc(s).weights,p), w=out.weights;
    expect(w.every((x,i)=>x>=p.lower[i]-1e-12&&x<=p.upper[i]+1e-12)).toBe(true);
    expect(w[3]+w[4]).toBeLessThanOrEqual(p.cryptoCap+1e-12);
    const objective=(x:number[])=>{
      const a=s.map(row=>row.reduce((sum,y,i)=>sum+y*x[i],0));
      const q=x.reduce((sum,y,i)=>sum+y*a[i],0);
      return x.reduce((sum,y,i)=>sum+(y*a[i]/q-0.2)**2,0);
    };
    const f=objective(w);
    expect(Math.abs(f-out.solver.objective)).toBeLessThan(1e-12);
    for(let i=0;i<5;i++)for(let j=0;j<5;j++)if(i!==j) {
      const candidate=[...w]; candidate[i]-=1e-6;candidate[j]+=1e-6;
      if(candidate.some((x,k)=>x<p.lower[k]||x>p.upper[k])||candidate[3]+candidate[4]>p.cryptoCap)continue;
      expect(objective(candidate)).toBeGreaterThanOrEqual(f-1e-12);
    }
  }
});

import { initialState } from '../src/persistence/schema';
import { calculate, inputFromState } from '../src/snapshots/calculate';
it('calculation rejects the economically material contradictory-FX fixture', () => {
 const state=initialState();state.model='erc';
 state.holdings=state.holdings.map((h,i)=>({...h,units:0,priceDKK:[1000,2000,1500,500000,20000][i],priceAsOf:auditTime}));
 state.dataset=demoDataset(auditTime);
 state.dataset.classification='user-supplied';state.acknowledgeUserData=true;
 const prev=state.dataset.rows.at(-2)!;
 state.dataset.rows.at(-1)!.fx={...prev.fx,rate:prev.fx.rate*1.1};
 expect(() => calculate(inputFromState(state,auditTime))).toThrow('FX_OBSERVATION_CONFLICT');
});
// Reusing an unchanged as-of observation is legitimate (weekends/holidays).
it('accepts an unchanged reused FX observation and a separately published revision', () => {
 const d=demoDataset(auditTime),prev=d.rows.at(-2)!;
 d.rows.at(-1)!.fx={...prev.fx};
 expect(prepareRisk(d,auditTime,504).returns.length).toBe(504);
 d.rows.at(-1)!.fx.rate*=1.01;
 d.rows.at(-1)!.fx.publishedAt=d.rows.at(-1)!.closeAt;
 expect(prepareRisk(d,auditTime,504).returns.length).toBe(504);
});
it('equivalent timestamp spellings cannot bypass FX identity validation', () => {
 const d=demoDataset(auditTime),prev=d.rows.at(-2)!;
 d.rows.at(-1)!.fx={...prev.fx,observedAt:prev.fx.observedAt.replace('.000Z','Z'),rate:prev.fx.rate*1.1};
 expect(() => prepareRisk(d,auditTime,504)).toThrow('FX_OBSERVATION_CONFLICT');
});

import legacy from './legacy-snapshot.json';
import { validateSeal } from '../src/snapshots/integrity';
it('valid sealed 1.0.0 snapshot from the original release retains hash and economic output', async () => {
 const restored=await validateSeal(legacy);
 expect(restored).toEqual(legacy);
 expect(restored.snapshot.versions.engine).toBe('1.0.0');
});
