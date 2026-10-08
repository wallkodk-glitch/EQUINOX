// Replays real public row projections, not a fabricated native HTTP response.
// Configured-connector acquisition is separate from local-key/browser evidence.
import { readFile, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
import { createServer } from 'vite';
const raw=JSON.parse(await readFile('validation/closure-final-provider-rows.json','utf8'));
const fx=JSON.parse(await readFile('validation/closure-final-fx.json','utf8'));
assert.equal(raw.format,'EQUINOX_AUTHENTICATED_TYPED_PROVIDER_PROJECTION_V1');
assert.equal(raw.complete,true);assert.equal(raw.grid.length,253);
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
  const {ASSETS}=await server.ssrLoadModule('/src/domain/core.ts');
  const {observation,MARKET_DATA_MODEL_VERSION,SOURCES}=await server.ssrLoadModule('/src/market-data/live/model.ts');
  const {riskActionEvidence}=await server.ssrLoadModule('/src/market-data/live/risk-actions.ts');
  const {buildSynchronizedRisk}=await server.ssrLoadModule('/src/market-data/live/synchronized.ts');
  const {prepareRisk}=await server.ssrLoadModule('/src/market-data/provider.ts');
  const {initialState}=await server.ssrLoadModule('/src/persistence/schema.ts');
  const {calculate,inputFromState,canonical}=await server.ssrLoadModule('/src/snapshots/calculate.ts');
  const {seal,validateSeal}=await server.ssrLoadModule('/src/snapshots/integrity.ts');
  const {covariance,correlation}=await server.ssrLoadModule('/src/risk/math.ts');
  const observations={};
  for(const [i,instrument] of ASSETS.entries()){
    const entry=raw.data[instrument];assert.equal(entry.bars.length,253);
    assert.equal(entry.pages.reduce((n,p)=>n+p.selected,0),253);
    assert(entry.pages.every(p=>p.invalidRows===0&&p.nonmonotonicRows===0&&p.uniqueTimestamps));
    observations[instrument]=entry.bars.map(b=>{
      assert([b.t,b.o,b.h,b.l,b.c,b.v].every(Number.isFinite));
      assert(b.o>0&&b.h>0&&b.l>0&&b.c>0&&b.v>=0&&b.h>=Math.max(b.o,b.c)&&b.l<=Math.min(b.o,b.c));
      const start=new Date(b.t).toISOString(),end=new Date(b.t+60000).toISOString();
      // Fields below are normalized provenance. They are NOT claimed as the
      // original provider envelope, which the protected connector does not expose.
      return observation({schemaVersion:1,dataModelVersion:MARKET_DATA_MODEL_VERSION,provider:'massive',instrument,
        observationDate:start.slice(0,10),providerTimestamp:start,observationTimestamp:end,acquiredAt:b.acquiredAt,
        price:b.c,unit:'USD',kind:i<3?'equity-minute':'crypto-minute',bucketStart:start,bucketEnd:end,
        sourceURL:SOURCES.massive,semantics:'LAST_ELIGIBLE_TRADE_IN_MINUTE'});
    });
  }
  // Actual collection-completion timestamp is a fixed validation input. Repeated
  // offline replays must not silently acquire a new calculation clock/hash.
  const acquiredAt=raw.acquiredAt;
  const actions=['GOOGL','ISRG','TSM'].map(ticker=>{
    const a=raw.actions[ticker];assert.equal(a.complete,true);
    return riskActionEvidence(a.rawSplits,a.rawDividends,ticker,raw.grid[0].date,raw.grid.at(-1).date,a.acquiredAt);
  });
  const dataset=buildSynchronizedRisk({now:acquiredAt,lookback:252,observations,corporateActions:actions,fx:fx.normalized});
  const prepared=prepareRisk(dataset,acquiredAt,252);
  assert.equal(prepared.coverage,1);assert.equal(prepared.returns.length,252);assert.deepEqual(prepared.missingDates,[]);
  assert.equal(dataset.rows.find(r=>r.date==='2026-09-16').dividendUSD[2],1.096251);
  const state=initialState();state.dataset=dataset;state.lookback=252;state.acknowledgeUserData=true;state.capital=3500;
  // Synthetic holdings for a validation calculation only. These are NOT the
  // user's portfolio, current CoinGecko valuation or a live price confirmation.
  const quantities=[3,2,1,0.015,0.25],prices=prepared.levelsDKK.at(-1);
  state.holdings.forEach((h,i)=>{h.units=quantities[i];h.priceDKK=prices[i];h.priceAsOf=prepared.latestClose;});
  const hashes={},snapshots={};
  for(const model of ['equal','inverse','erc']){
    state.model=model;const input=inputFromState(state,acquiredAt),result=calculate(input),again=calculate(structuredClone(input));
    assert.equal(canonical(result),canonical(again));
    const sealed=await seal(result);assert.equal(canonical(await validateSeal(sealed)),canonical(sealed));
    assert.equal(sealed.snapshot.versions.engine,'1.0.1');assert.equal(sealed.snapshot.schemaVersion,2);
    hashes[model]=sealed.sha256;snapshots[model]=sealed;
  }
  const legacy=JSON.parse(await readFile('validation/node-snapshot.json','utf8'));
  assert.equal(legacy.sha256,'e491090dd7e2cf8a81bd33c23d67460158aab62bac455d2f177de25038c50891');
  assert.equal(canonical(await validateSeal(legacy)),canonical(legacy));
  const matrix=covariance(prepared.returns,252);
  const evidence={format:'EQUINOX_REAL_SYNCHRONIZED_RISK_VALIDATION_V1',checkedAt:new Date().toISOString(),validationAsOf:acquiredAt,status:'PASS',
    providerTransport:raw.sourceScope,browserCORS:'NOT TESTED',windowStart:prepared.windowStart,windowEnd:prepared.windowEnd,
    alignedObservations:prepared.alignedObservations,returns:prepared.returns,levelsDKK:prepared.levelsDKK,
    returnDates:prepared.returnDates,covariance:matrix,correlation:correlation(matrix),coverage:prepared.coverage,
    missingDates:prepared.missingDates,fxPolicy:prepared.fxPolicy,normalizedInput:dataset,snapshotHashes:hashes,
    frozenEngine:'1.0.1',sameNormalizedInputSameOutput:true,allThreeModelSnapshotsReplayed:true,
    legacySnapshotReplayed:true,legacySnapshotSHA256:legacy.sha256,
    valuationScope:'Synthetic validation holdings; last synchronized close quotes, not current live portfolio valuation.'};
  await writeFile('validation/closure-final-synchronized.json',JSON.stringify(evidence,null,2));
  await writeFile('validation/closure-final-snapshots.json',JSON.stringify(snapshots,null,2));
  console.log(JSON.stringify({status:evidence.status,windowStart:prepared.windowStart,windowEnd:prepared.windowEnd,
    observations:prepared.alignedObservations,returns:prepared.returns.length,coverage:prepared.coverage,snapshotHashes:hashes,
    legacySnapshotSHA256:legacy.sha256,browserCORS:'NOT TESTED'}));
} finally {await server.close();}
