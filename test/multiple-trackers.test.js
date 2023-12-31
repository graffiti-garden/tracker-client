import { assert, describe, expect, it } from 'vitest'
import TrackerClient from '../tracker-client'
import { randomHash, sha256Hex } from '../src/util'

const trackerLinks = [
  "ws://localhost:8000",
  "wss://tracker.graffiti.garden"
]

describe('Multiple trackers', ()=> {

  it("Overlapping tracker subscriptionss", async()=> {
    const infoHash = await randomHash()

    // 0 announce -> heard by 0, 1, 2
    // 1 announce -> heard by 0, 1
    // 2 announce -> heard by 0, 2
    const clients = [
      new TrackerClient(
        await randomHash(),
        trackerLinks),
      new TrackerClient(
        await randomHash(),
        [trackerLinks[0]]),
      new TrackerClient(
        await randomHash(),
        [trackerLinks[1]])
    ]
    const announces = [[],[],[]]
    const peers = await Promise.all(clients.map(c=>sha256Hex(c.peerProof)))

    const listeners = [0,1,2].map(i=> async()=> {
      for await (const message of clients[i].subscribe(infoHash)) {
        announces[i].push(message.peer)
      }
    })
    listeners.forEach(l=>l())

    await clients[0].announce(infoHash)
    await clients[1].announce(infoHash)
    await clients[2].announce(infoHash)
    await new Promise(r=> setTimeout(r, 3000));

    assert(announces[0].includes(peers[1]))
    assert(announces[0].includes(peers[2]))
    assert(announces[1].includes(peers[0]))
    assert(announces[1].includes(peers[1]))
    assert(announces[2].includes(peers[0]))
    assert(announces[2].includes(peers[2]))
  })


  it("One downed tracker", async()=> {
      const tc = new TrackerClient(
        await randomHash(),
        [...trackerLinks,
        "ws://tracker.example.com"])

      await new Promise(r=> setTimeout(r, 2000))
      
      const output = await tc.announce(await randomHash())
      expect(output.length).to.equal(3)
      expect(output[0]).to.equal("announced")
      expect(output[1]).to.equal("announced")
      expect(output[2]).to.equal("pending connect")
  })
})
