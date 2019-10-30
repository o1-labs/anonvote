import {Client as WebSocketClient} from 'rpc-websockets'
import Snarky from 'snarkyjs'
import {bn128} from 'snarkyjs-crypto'

import {AttributeMask} from './data/voter_attributes'
import Election from './data/Election'
import ElectionDB from './data/ElectionDB'
import NetworkState from './data/NetworkState'
import SnarkKeys from './data/SnarkKeys'
import Vote from './data/Vote'
import Voter from './data/Voter'

import repl from './util/repl'

if(process.argv.length < 3) {
  console.error('required voter json argument is missing')
  process.exit(1)
}
const voterJsonFile = process.argv[2]
var serverUri = process.argv.length >= 4 ? process.argv[3] : 'localhost:8080'
if(serverUri.indexOf('ws://') !== 0)
  serverUri = 'ws://' + serverUri

// TODO: take in positional CLI arg for server address
const voter = new Voter(process.argv[2])
const snarkProcess = new Snarky('src/snark.exe')
const ws = new WebSocketClient(serverUri)

function parseAnswer(answer) {
  switch(answer) {
    case 'y':
    case 'Y':
      return true
      break
    case 'n':
    case 'N':
      return false
      break
    default:
      throw new Error('invalid vote (valid answers are "Y/N" or "y/n")')
  }
}

function register() {
  return ws.call('register', [voter.commitment.toString()])
}

function proveMembership() {
  return ws.call('proveMembership', [voter.commitment.toString()])
}

function createElection(election) {
  return ws.call('createElection', election)
}

function castVote(vote, voteSnark) {
  return ws.call('castVote', [vote, voteSnark])
}

function waitForRegistrationToClose() {
  ws.subscribe('networkState')
  return new Promise((resolve, reject) => {
    ws.on('networkState', function() {
      ws.unsubscribe('networkState')
      resolve()
    })
  })
}

function run(merkleTreeRoot, electionDb) {
  ws.subscribe('elections')
  ws.on('elections', (electionData) => {
    const election = Election.fromJson(electionData)
    if(!electionDb.exists(election.commitment))
      electionDb.add(election)
  })

  ws.subscribe('votes')
  ws.on('votes', (voteData) => {
    const vote = Vote.fromJson(voteData)
    // if(vote.voterCommitment !== voter.commitment)
    //   electionDb.recordVote(Vote.fromJson(vote))
    electionDb.recordVote(Vote.fromJson(vote))
  })

  return repl('voter', {
    list() {
      electionDb.print()
    },

    tally(electionId) {
      const election = electionDb.get(electionId)
      if(!election)
        throw new Error('election not found')
      election.printTally()
    },

    // TODO: parse required attributes
    create(summary, ...attributeConstraints) {
      const attributeMask = new AttributeMask(attributeConstraints)
      const election = new Election(summary, attributeMask)
      electionDb.add(election)

      return createElection(election.toJson())
        .then(() => console.log('success'))
        .catch((err) => console.error('RPC ERROR:', err))
    },

    vote(electionCommitment, answer) {
      const election = electionDb.get(bn128.Field.ofString(electionCommitment))
      if(!election)
        throw new Error('election not found')

      const vote = new Vote(voter, election, parseAnswer(answer))

      console.log({
        statement: vote.statement(merkleTreeRoot, election),
        witness: voter.witness()
      })
      return snarkProcess.prove({
        statement: vote.statement(merkleTreeRoot, election),
        witness: voter.witness()
      })
        .catch(function(err) {throw `failed to construct vote proof -- ${JSON.stringify([...arguments])}`})
        .then((proof) =>
          castVote(vote.toJson(), proof)
            .then(() => console.log('vote successfully cast')))
            .catch((err) => {throw `error casting vote -- ${JSON.stringify(err)}`})
    },

    exit() {
      ws.close()
      return true
    }
  })
}

function acquireMembershipProof(networkState) {
  switch(networkState) {
    case NetworkState.Registration:
      console.log('registering')
      return register()
        .then(() => {
          console.log('successfully registered, waiting for registration to close')
          return waitForRegistrationToClose()
        })
        .then(proveMembership)
      break
    case NetworkState.Polling:
      return proveMembership()
      break
    default:
      throw new Error('unexpected network state')
  }
}

function synchronizeSnarkKeys(targetSnarkKeysHash) {
  return new Promise((resolve) => {
    var snarkKeys
    try {snarkKeys = new SnarkKeys()} catch(err) {snarkKeys = null}
    if(!snarkKeys || snarkKeys.keysHash !== targetSnarkKeysHash) {
      getSnarkKeys().then(SnarkKeys.write).then(resolve)
    } else {
      resolve()
    }
  })
}

function initialize(initialState) {
  return synchronizeSnarkKeys(initialState.snarkKeysHash)
    .then(() => acquireMembershipProof(initialState.networkState))
    .then((response) => {
      voter.setMembershipProof(response.membershipProof)
      const electionDb = new ElectionDB()
      // TODO: is bind required for es6 classes?
      initialState.elections.forEach((electionData) =>
        electionDb.add(Election.fromJson(electionData)))
      initialState.votes.forEach((voteData) =>
        electionDb.recordVote(Vote.fromJson(voteData)))
      return run(bn128.Field.ofString(response.merkleTreeRoot), electionDb)
    })
}

ws.on('open', () => {
  console.log('connected')
  ws.call('init')
    .then(initialize)
    .then(() =>
      console.log('goodbye'))
    .catch((err) =>
      console.error('FATAL ERROR:', err))
    .then(() => {
      ws.close()
      snarkProcess.kill()
    })
})

ws.on('error', (err) => {
  console.error('WEBSOCKET/RPC ERROR:', err)
  process.exit(1)
})
