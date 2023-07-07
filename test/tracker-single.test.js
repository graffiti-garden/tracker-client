import { describe, expect, it } from 'vitest'
import TrackerSingle from '../src/tracker-single'
import { sha256Hex } from '../src/util'

async function randomHash() {
  return await sha256Hex(crypto.randomUUID())
}

async function connectToTracker(onUpdate=()=>{}) {
  return new TrackerSingle(
    await randomHash(),
    "wss://tracker.graffiti.garden",
    onUpdate
  )
}

describe('Tracker Single', ()=> {

  // TODO:
  // - invalid double subscription with same peer
  // - full client with multiple trackers

  it('Error on invalid hash', async () => {
    const ts = await connectToTracker()
    await expect(
      ts.request("announce", "1234")
    ).rejects.toThrowError()
  })

  it('Announced correct hash', async () => {
    const ts = await connectToTracker()
    await expect(
      ts.request("announce", await randomHash())
    ).resolves.to.equal("announced")
  })

  it('Multiple hashes', async () => {
    const ts = await connectToTracker()
    await expect(
      ts.request("announce",
      await randomHash(),
      await randomHash())
    ).resolves.to.equal("announced")
  })

  it('Invalid action', async () => {
    const ts = await connectToTracker()
    await expect(
      ts.request("actnow",
      await randomHash(),
      await randomHash())
    ).rejects.toThrowError()
  })

  it('sub->ann->unann->unsub->ann', async () => {
    let numUpdates = 0

    const hash = await randomHash()
    const ts1 = await connectToTracker()
    const ts2 = await connectToTracker(
      async (update)=> {
        expect(update.peer).to.equal(await sha256Hex(ts1.peerProof))
        expect(update.info_hash).to.equal(hash)
        if (!numUpdates) {
          expect(update.action).to.equal("announce")
        } else {
          expect(update.action).to.equal("unannounce")
        }
        numUpdates++
      }
    )

    await expect(
      ts2.request("subscribe", hash)
    ).resolves.to.equal("subscribed")
    await expect(
      ts1.request("announce", hash)
    ).resolves.to.equal("announced")

    await new Promise(r=> setTimeout(r, 100));
    expect(numUpdates).to.equal(1)

    await expect(
      ts1.request("unannounce", hash)
    ).resolves.to.equal("unannounced")

    await new Promise(r=> setTimeout(r, 100));
    expect(numUpdates).to.equal(2)

    await expect(
      ts2.request("unsubscribe", hash)
    ).resolves.to.equal("unsubscribed")
    await expect(
      ts1.request("announce", hash)
    ).resolves.to.equal("announced")

    await new Promise(r=> setTimeout(r, 100));
    expect(numUpdates).to.equal(2)
  })

  it("Disconnect unannounce", async ()=>{
    let numUpdates = 0
    const hash = await randomHash()
    const ts1 = await connectToTracker()
    const ts2 = await connectToTracker(
      async (update)=> {
        expect(update.peer).to.equal(await sha256Hex(ts1.peerProof))
        expect(update.info_hash).to.equal(hash)
        if (!numUpdates) {
          expect(update.action).to.equal("announce")
        } else {
          expect(update.action).to.equal("unannounce")
        }
        numUpdates++
      }
    )

    await expect(
      ts2.request("subscribe", hash)
    ).resolves.to.equal("subscribed")
    await expect(
      ts1.request("announce", hash)
    ).resolves.to.equal("announced")

    ts1.close()
    await new Promise(r=> setTimeout(r, 100));
    expect(numUpdates).to.equal(2)
  })
})