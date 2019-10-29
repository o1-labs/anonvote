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
    console.log(election.commitment.toString())
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

  print() {
    console.log(Object.keys(this.#elections)
      .map((id) => `[${id}] : ${this.get(id).summary}`)
      .join('\n'))
  }
}
