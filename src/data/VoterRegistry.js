import {bn128} from 'snarkyjs-crypto'

export default class VoterRegistry {
  constructor() {
    this.registrationOpen = true
    this.memberCommitments = new Set()
    this.merkleTree = null
  }

  register(commitment) {
    if(!this.registrationOpen)
      throw new Error('registration is closed')

    if(this.memberCommitments.has(commitment))
      throw new Error('already registered')

    this.memberCommitments.add(commitment.toString())
  }

  closeRegistration() {
    console.log('closing registration with commitments:')
    this.memberCommitments.forEach((c) =>
      console.log('- ' + c))

    this.registrationOpen = false
    this.merkleTree = new bn128.MerkleTree.ofArray(
      // our merkle tree leaves are already hashed, so the hash function
      // is an identity
      (commitment) => bn128.Field.ofString(commitment),
      // empty leaves will be filled with the hash of 0
      bn128.Hash.hash(bn128.Field.zero),
      // the leaves of our merkle tree are the commitments to the voter entries
      [...this.memberCommitments]
    )
  }

  proveMembership(commitment) {
    const index = [...this.memberCommitments].indexOf(commitment.toString())
    if(index < 0)
      return null
    return bn128.MerkleTree.MembershipProof.create(this.merkleTree, index)
  }
}
