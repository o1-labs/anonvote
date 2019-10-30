import {Server as WebSocketServer} from 'rpc-websockets'
import Snarky from 'snarkyjs'

import Election from './data/Election'
import ElectionDB from './data/ElectionDB'
import NetworkState from './data/NetworkState'
import SnarkKeys from './data/SnarkKeys'
import Vote from './data/Vote'
import VoterRegistry from './data/VoterRegistry'

import repl from './util/repl'

const port = process.argv.length >= 3 ? process.argv[2] : '8080'

const snarkProcess = new Snarky('src/snark.exe')
const voterRegistry = new VoterRegistry()
const electionDb = new ElectionDB()
var networkState = NetworkState.Registration

function setupServer(snarkKeys) {
  const ws = new WebSocketServer({port})

  // -- Event streams
  // state: broadcasts updates to network state
  ws.event('networkState')
  // elections: broadcasts newly added elections
  ws.event('elections')
  // votes: broadcasts votes on elections
  ws.event('votes')

  // -- Network state management
  const setNetworkState = (state) => {
    networkState = state
    ws.emit('networkState', state)
  }

  // ==========
  // == RPCs ==
  // ==========

  // init: returns initial state information
  ws.register('init', () => ({
    networkState,
    snarkKeysHash: snarkKeys.keysHash,
    elections: electionDb.dump().map((e) => e.toJson()),
    votes: electionDb.dump().map((e) => e.votes.map((v) => v.toJson())).flat()
  }))

  // getKeys: returns proving and verification keys
  ws.register('getKeys', () => ({
    provingKey: snarkKeys.provingKey,
    verificationKey: snarkKeys.verificationKey
  }))

  // register: register a new commitment to a voter
  ws.register('register', function([commitment]) {
    if(networkState !== NetworkState.Registration)
      throw new Error('registration is not open')

   voterRegistry.register(commitment)
  })

  // TODO: support custom election options?
  // createElection: register a new election which voters can vote on
  ws.register('createElection', function(electionData) {
    if(networkState !== NetworkState.Polling) {
      throw new Error('registration is still open')
    }

    const election = Election.fromJson(electionData)
    electionDb.add(election)
    ws.emit('elections', electionData)
  })

  // proveMembership: prove voter membership (needed as a witness to the vote SNARK)
  ws.register('proveMembership', function([commitment]) {
    const membershipProof = voterRegistry.proveMembership(commitment)
    if(!membershipProof) throw new Error('not a member')
    const merkleTreeRoot = voterRegistry.merkleTreeRoot()
    return {
      membershipProof: {
        index: membershipProof.index,
        path: membershipProof.path.map((el) => el.toString())
      },
      merkleTreeRoot: merkleTreeRoot.toString()
    }
  })

  // castVote: submit a vote for an ongoing election
  ws.register('castVote', function([voteData, proof]) {
    console.log('voteData:', voteData)
    const vote = Vote.fromJson(voteData)

    const election = electionDb.get(vote.electionCommitment)
    if(!election)
      throw new Error('election not found')

    // const membershipProof = voterRegistry.proveMembership(vote.voterCommitment)
    // if(!membershipProof)
    //   throw new Error('voter is not a member')

    return snarkProcess.verify({
      statement: vote.statement(voterRegistry.merkleTreeRoot(), election),
      proof
    })
      .catch((err) => {throw `failed to verify snark proof: ${JSON.stringify(err)}`})
      .then(() => {
        election.recordVote(vote)
        ws.emit('votes', vote.toJson())
      })
  })
  
  return {
    ws,
    setNetworkState
  }
}

function runRepl(server) {
  return repl('registrar', {
    close() {
      if(networkState === NetworkState.Polling)
        throw new Error('registration has already been closed')

      voterRegistry.closeRegistration()
      server.setNetworkState(NetworkState.Polling)
    },

    list() {
      if(networkState === NetworkState.Registration)
        throw console.error('registration is still open')

      electionDb.print()
    },

    tally(electionCommitment) {
      if(networkState === NetworkState.Registration)
        throw new Error('registration is still open')

      const election = electionDb.get(electionCommitment)
      if(!election)
        throw new Error('election not found')

      election.printTally()
    },

    exit: () => true
  })
}

snarkProcess.generate_keys()
  .catch((err) => {throw err})
  .then(() => {
    const snarkKeys = new SnarkKeys ()
    const server = setupServer(snarkKeys)

    console.log('*** Registrar is now running ***')
    runRepl(server)
      .then(() => console.log('goodbye'))
      .catch((err) => console.error('FATAL ERROR:', err))
      .then(() => {
        server.ws.close()
        snarkProcess.kill()
      })
})
