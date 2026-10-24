const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BlockchainService } = require('../dist/services/blockchainService.js');
const { Store } = require('../dist/store.js');
const missionController = require('../dist/controllers/missionControllers.js');

function response() {
  return { code: 200, body: undefined, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('legacy payment execution is explicitly simulated and returns no transaction hash', async () => {
  delete process.env.USE_REAL_CONTRACT;
  const result = await BlockchainService.executeOnChain('merchant', 10, 'session-key');
  assert.deepEqual(result, { success: true, simulated: true, broadcasted: false });
  assert.equal('txHash' in result, false);
});

test('legacy real deployment and payment execution fail closed', async () => {
  process.env.USE_REAL_CONTRACT = 'true';
  await assert.rejects(BlockchainService.deployMissionWallet('merchant', 10), /unavailable/);
  await assert.rejects(BlockchainService.deployRealMissionWallet('name', 'id', 'category', 10, 'merchant'), /unavailable/);
  await assert.rejects(BlockchainService.executeOnChain('wallet', 10, 'session-key'), /does not match IMissionWallet/);
  await assert.rejects(BlockchainService.triggerKillSwitch('wallet', 'freeze'), /unavailable/);
  delete process.env.USE_REAL_CONTRACT;
});

test('mission read APIs omit internal session keys and label demo wallet status', () => {
  const mission = { id: 'mission-api-test', name: 'Test', missionId: 'MID-TEST', merchant: 'merchant', budget: 10, spent: 0, expiry: new Date(Date.now() + 60_000).toISOString(), trustScore: 100, status: 'created', createdAt: Date.now(), sessionKey: 'private-session-key' };
  Store.updateMission(mission);
  const list = response(); missionController.listMissions({}, list);
  assert.equal(list.body.missions.find(row => row.id === mission.id).sessionKey, undefined);
  const status = response(); missionController.getWalletStatus({ params: { missionId: mission.id } }, status);
  assert.deepEqual(status.body.wallet, { mode: 'demo', deployed: false, onChainRevocation: 'not_performed' });
});
