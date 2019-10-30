import fs from 'fs'
import md5 from 'js-md5'

export default class SnarkKeys {
  constructor() {
    this.provingKey = fs.readFileSync('proving_key.pk')
    this.verificationKey = fs.readFileSync('verification_key.vk')
    this.keysHash = md5(this.provingKey + this.verificationKey)
  }
}

SnarkKeys.write = function({provingKey, verificationKey}) {
  fs.writeFileSync('proving_key.pk', Buffer.from(provingKey))
  fs.writeFileSync('verification_key.vk', Buffer.from(verificationKey))
}
