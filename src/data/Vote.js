import {bn128} from 'snarkyjs-crypto'

import hashString from '../util/hashString'

import Election from './Election'

export default class Vote {
  constructor(voter, election, answer) {
    this.voterCommitment = voter.commitment
    this.electionCommitment = election.commitment
    this.ballot = voter.ballot(election.commitment)
    this.answer = answer
  }

  statement(election) {
    if(!(election instanceof Election))
      throw new Error('Vote.statement() expects to receive election')

    if(!(election.commitment === this.electionCommitment))
      throw new Error('Vote.statement() received the wrong election')

    return [
      this.voterCommitment.toString(),
      this.ballot.toString(),
      hashString(this.answer).toString(),
      election.attributeMask.mask.map((c) => c ? c.toString() : c),
      this.electionCommitment.toString()
    ]
  }

  toJson() {
    const {voterCommitment, electionCommitment, ballot, answer} = this
    return {
      voterCommitment: voterCommitment.toString(),
      electionCommitment: electionCommitment.toString(),
      ballot: ballot.toString(),
      answer
    }
  }
}

Vote.fromJson = function(json) {
  const requiredParams = ['voterCommitment', 'electionCommitment', 'ballot', 'answer']

  requiredParams.forEach((requiredParam) => {
    if(!(requiredParam in json) || typeof json[requiredParam] !== 'string')
      throw `Vote.fromJson: missing or invalid parameter "${requiredParam}"`
  })

  return {
    __proto__: Voter.prototype,
    voterCommitment: bn128.Field.ofString(json.voterCommitment),
    electionCommitment: bn128.Field.ofString(json.electionCommitment),
    ballot: bn128.Field.ofString(json.ballot),
    answer: json.answer
  }
}
