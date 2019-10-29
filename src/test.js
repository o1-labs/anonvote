import Snarky from 'snarkyjs'

import Election from './data/Election'
import Vote from './data/Vote'
import Voter from './data/Voter'
import VoterRegistry from './data/VoterRegistry'
import {AttributeMask} from './data/voter_attributes'

const snarkProcess = new Snarky('src/snark.exe')
const voterRegistry = new VoterRegistry()

const ada = new Voter('ada.json')
const bob = new Voter('bob.json')
const joyce = new Voter('joyce.json')
voterRegistry.register(ada.commitment)
voterRegistry.register(bob.commitment)
voterRegistry.register(joyce.commitment)
voterRegistry.closeRegistration()

ada.setMembershipProof(voterRegistry.proveMembership(ada.commitment))
bob.setMembershipProof(voterRegistry.proveMembership(bob.commitment))
joyce.setMembershipProof(voterRegistry.proveMembership(joyce.commitment))

const election = new Election('test', new AttributeMask([]))
const vote = new Vote(ada, election, true)

console.log(ada.witness()[1].path)

console.log({
  statement: vote.statement(voterRegistry.merkleTreeRoot(), election),
  witness: ada.witness()
})
snarkProcess.prove({
  statement: vote.statement(voterRegistry.merkleTreeRoot(), election),
  witness: ada.witness()
})
  .then((proof) => console.log(`success -- ${proof}`))
  .catch(console.log)
  //.catch((err) => console.log(`failed to construct vote proof -- ${err}`))
