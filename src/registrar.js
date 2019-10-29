import {Server as WebSocketServer} from 'rpc-websockets'
import Snarky from 'js_snarky'

import Election from './data/Election'
import ElectionDB from './data/ElectionDB'
import NetworkState from './data/NetworkState'
import VoterRegistry from './data/VoterRegistry'

import repl from './util/repl'

const snarkProcess = new Snarky('src/snark.exe')
const server = new WebSocketServer({port: '8080'})
const voterRegistry = new VoterRegistry()
const electionDb = new ElectionDB()

// -- Event streams
// state: broadcasts updates to network state
server.event('networkState')
// elections: broadcasts newly added elections
server.event('elections')
// votes: broadcasts votes on elections
server.event('votes')

// -- Network state management
var networkState = NetworkState.Registration
const setNetworkState = (state) => {
  networkState = state
  server.emit('networkState', state)
}

// ==========
// == RPCs ==
// ==========

// init: returns initial state information
server.register('init', () => ({
  networkState,
  elections: electionDb.dump().map((e) => e.toJson()),
  votes: electionDb.dump().map((e) => e.votes.map((v) => v.toJson())).flat()
}))

// register: register a new commitment to a voter
server.register('register', function([commitment]) {
  if(networkState !== NetworkState.Registration)
    throw new Error('registration is not open')

 voterRegistry.register(commitment)
})

// TODO: support custom election options?
// createElection: register a new election which voters can vote on
server.register('createElection', function(electionData) {
  if(networkState !== NetworkState.Polling) {
    throw new Error('registration is still open')
  }

  const election = Election.fromJson(electionData)
  electionDb.add(election)
  server.emit('elections', electionData)
})

// proveMembership: prove voter membership (needed as a witness to the vote SNARK)
server.register('proveMembership', function([commitment]) {
  const proof = voterRegistry.proveMembership(commitment)
  if(!proof) throw new Error('not a member')
  // TODO: create toJson on proof from snarkyjs-crypto
  return {
    index: proof.index,
    path: proof.path.map((el) => el.toString())
  }
})

// castVote: submit a vote for an ongoing election
server.register('castVote', function([voteData, proof]) {
  console.log('voteData:', voteData)
  const vote = Vote.fromJson(voteData)

  const election = electionDb.get(vote.electionId)
  if(!election)
    throw new Error('election not found')

  return snarkProcess.verify({
    statement: vote.statement(election),
    proof
  })
    .catch((err) => {throw `failed to verify snark proof: ${JSON.stringify(err)}`})
    .then(() => {
      election.addVote(vote)
      server.emit('votes', vote.toJson())
    })
})

// ==========
// == REPL ==
// ==========

console.log('*** Registrar is now running ***')

repl('registrar', {
  close() {
    if(networkState === NetworkState.Polling)
      throw new Error('registration has already been closed')

    voterRegistry.closeRegistration()
    setNetworkState(NetworkState.Polling)
  },

  list() {
    if(networkState === NetworkState.Registration)
      throw console.error('registration is still open')

    electionDb.print()
  },

  tally(electionId) {
    if(networkState === NetworkState.Registration)
      throw new Error('registration is still open')

    const election = electionDb.get(electionId)
    if(!election)
      throw new Error('election not found')

    election.tally()
  },

  exit: () => true
})
  .then(() => console.log('goodbye'))
  .catch((err) => console.error('FATAL ERROR:', err))
  .then(() => {
    server.close()
    snarkProcess.kill()
  })
