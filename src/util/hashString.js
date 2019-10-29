import {bn128} from 'snarkyjs-crypto'

// This is an inefficient way to hash a string, but it's easy and it works :)
export default function hashString(name) {
  const charFields = Array.from(name).map((char) =>
    bn128.Field.ofInt(char.charCodeAt(0)))

  return bn128.Hash.hash(charFields)
}
