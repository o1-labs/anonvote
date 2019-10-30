import chalk from 'chalk'

import Election from './Election'

export default class ElectionDB {
  #elections = {}

  exists(commitment) {
    return commitment in this.#elections
  }
  
  add(election) {
    if(!(election instanceof Election))
      throw new Error('can only add instances of Election to an ElectionDB')
    if(this.exists(election.commitment))
      throw new Error('election with same id already registered')
    this.#elections[election.commitment.toString()] = election
  }

  get(commitment) {
    return commitment in this.#elections ? this.#elections[commitment.toString()] : null
  }

  dump() {
    return Object.values(this.#elections)
  }

  recordVote(vote) {
    this.get(vote.electionCommitment).recordVote(vote)
  }

  summarizeElection(voter, commitment) {
    const election = this.get(commitment)
    const color = voter.canVote(election).answer ? chalk.green : chalk.red
    return color(`[${commitment}] : ${election.summary} || ${election.attributeMask.summarize()}`)
  }

  print(voter) {
    const str = Object.keys(this.#elections).map(this.summarizeElection.bind(this, voter)).join('\n')
    console.log(str)
  }
}
