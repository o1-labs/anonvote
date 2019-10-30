import fs from 'fs'
import {bn128} from 'snarkyjs-crypto'

import hashString from '../util/hashString'

import {attributeTags} from './voter_attributes'

// TEMP HACK FOR snarkyjs-crypto
global.crypto = require('crypto')

export default class Voter {
  constructor(configFile) {
    const config = JSON.parse(fs.readFileSync(configFile))

    const missingAttributes = []
    this.attributes = attributeTags.map((tag) => {
      if(!(tag in config.attributes))
        missingAttributes.push(tag)
      else
        return config.attributes[tag]
    })
    if(missingAttributes.length > 0)
      throw `"${configFile}" is missing voter attributes: ${missingAttributes}`

    this.attributeCommitments = this.attributes.map((attr) =>
      hashString(attr))

    if('privateKey' in config) {
      // this.privateKey = bn128.Schnorr.PrivateKey.ofString(config.privateKey)
      this.privateKey = bn128.Field.ofString(config.privateKey)
    } else {
      // this.privateKey = bn128.Schnorr.PrivateKey.ofString(bn128.Field.zero.toString())
      this.privateKey = bn128.Schnorr.PrivateKey.create()

      console.log('no private key found in voter config, adding and rewriting')
      config.privateKey = this.privateKey.toString()
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2))
    }

    this.commitment = bn128.Hash.hash([this.privateKey].concat(this.attributeCommitments))
    this.membershipProof = null
  }

  setMembershipProof(proof) {
    if(this.membershipProof)
      throw new Error('membership proof already set for voter')
    if(!proof)
      throw new Error('no proof provided to Voter.setMembershipProof')

    this.membershipProof = proof
  }

  ballot(electionCommitment) {
    return bn128.Hash.hash([this.privateKey, electionCommitment])
  }

  witness() {
    if(!this.membershipProof)
      throw new Error('cannot generate witness for voter without a membership proof')

    return [
      {privateKey: this.privateKey, attributes: this.attributeCommitments},
      this.membershipProof
    ]
  }

  canVote(election) {
    const unsatisfiedAttrs = []

    attributeTags.forEach((tag, i) => {
      const myAttrCommitment = this.attributeCommitments[i]
      const desiredAttribute = election.attributeMask.mask[i]

      if(desiredAttribute && hashString(desiredAttribute).toString() !== myAttrCommitment.toString())
        unsatisfiedAttrs.push({tag, value: desiredAttribute})
    })

    const answer = (unsatisfiedAttrs.length === 0)
    return {answer, unsatisfiedAttrs}
  }
}
