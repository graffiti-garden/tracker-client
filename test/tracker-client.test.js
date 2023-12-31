import { assert, describe, expect, it } from 'vitest'
import TrackerClient from '../tracker-client'
import { randomHash, sha256Hex } from '../src/util'

const trackerLinks = [
  "ws://localhost:8000",
  "wss://tracker.graffiti.garden"
]

trackerLinks.forEach(link=> {

describe('Client interface with single tracker', ()=> {

  it('basic announce subscribe', async ()=>{
    const infoHash = await randomHash()
    const tc1 = new TrackerClient(
      await randomHash(),
      [link])
    const tc2 = new TrackerClient(
      await randomHash(),
      [link])

    let count = 0
    const listener = async ()=> {
      for await (const message of tc1.subscribe(infoHash)) {
        expect(message.action).to.equal("announce")
        expect(message.peer).to.equal(await sha256Hex(tc2.peerProof))
        count++
      }
    }
    listener()

    await tc2.announce(infoHash)
    await new Promise(r=> setTimeout(r, 2000));
    expect(count).to.equal(1)
  })

  it('No double subscriptions', async ()=>{
    const infoHash = await randomHash()
    const tc = new TrackerClient(
      await randomHash(),
      [link])

    tc.subscribe(infoHash).next()
    expect(tc.subscribe(infoHash).next()).rejects.toThrowError()
  })

  it('Double subscription after finishing', async ()=>{
    const infoHash = await randomHash()
    const tc = new TrackerClient(
      await randomHash(),
      [link])

    const controller = new AbortController();
    const signal = controller.signal;
    tc.subscribe(infoHash, signal)
    controller.abort()

    await tc.announce(infoHash)

    const result = (await tc.subscribe(infoHash).next()).value
    expect(result.action).to.equal("announce")
    expect(result.peer).to.equal(await sha256Hex(tc.peerProof))
  })

  it('Unsubscribe by abort', async()=> {
    const infoHash = await randomHash()
    const tc = new TrackerClient(
      await randomHash(),
      [link])

    let actions = 0
    let timedOut = false
    const listener = async ()=> {
      try {
        for await (const message of tc.subscribe(infoHash, AbortSignal.timeout(3000))) {
          actions++
        }
      } catch(err) {
        if (err.name === "TimeoutError") {
          timedOut = true
        }
      }
    }
    listener()

    await new Promise(r=> setTimeout(r, 2000));
    await tc.announce(infoHash)
    await new Promise(r=> setTimeout(r, 2000));
    expect(actions).to.equal(1)
    await tc.announce(infoHash)
    await new Promise(r=> setTimeout(r, 2000));
    expect(actions).to.equal(1)
    assert(timedOut)
  }, 10000)
})
})
